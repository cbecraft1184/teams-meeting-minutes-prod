import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertMeetingSchema, insertMeetingMinutesSchema, insertActionItemSchema, insertMeetingTemplateSchema, insertAppSettingsSchema, insertMeetingEventSchema, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateMeetingMinutes, extractActionItems } from "./services/azureOpenAI";
import { authenticateUser, requireAuth, requireRole } from "./middleware/authenticateUser";
import { requireWebhookAuth } from "./middleware/requireServiceAuth";
import { documentExportService } from "./services/documentExport";
import { templateService } from "./services/templateService";
import { emailDistributionService } from "./services/emailDistribution";
import { accessControlService } from "./services/accessControl";
import { canManageActionItem } from "./services/accessControlService";
import { registerWebhookRoutes, registerAdminWebhookRoutes } from "./routes/webhooks";
import { uploadToSharePoint } from "./services/sharepointClient";
import { enqueueMeetingEnrichment } from "./services/callRecordEnrichment";
import { teamsBotAdapter } from "./services/teamsBot";
import { graphCalendarSync } from "./services/graphCalendarSync";
import { ZodError } from "zod";
import { serveStatic as setupProductionStatic } from "./static";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  
  // ========== GLOBAL PRE-ROUTING GUARD ==========
  // This middleware runs BEFORE express.static and ensures webhook requests 
  // are never accidentally served the SPA HTML
  app.use((req, res, next) => {
    const path = (req.originalUrl || req.path || '').toLowerCase();
    
    // Debug logging for webhook requests
    if (path.includes('/webhooks/') || path.includes('/api/')) {
      console.log(`[PRE-ROUTE GUARD] ${req.method} ${req.originalUrl} (path=${req.path})`);
    }
    
    next();
  });
  
  // ========== PUBLIC ENDPOINTS (NO AUTHENTICATION) ==========
  
  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  // CRITICAL: Register Microsoft Graph webhook callbacks FIRST
  // These are PUBLIC endpoints at /webhooks/* (NOT /api/*)
  // Microsoft Graph API calls these directly - NO user authentication
  // Security: clientState validation (shared secret)
  registerWebhookRoutes(app);

  // API health check endpoint (PUBLIC - no authentication required)
  // Used by Azure Container Apps health probes and Teams app connectivity checks
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  // ========== AUTHENTICATED ENDPOINTS (REQUIRE USER AUTH) ==========
  
  // Apply authentication middleware to ALL /api/* routes EXCEPT bot endpoint
  // In mock mode: Uses config/mockUsers.json
  // In production: Validates Azure AD JWT tokens
  app.use("/api/*", (req, res, next) => {
    if (req.path === "/api/teams/messages") {
      return next();
    }
    return authenticateUser(req, res, next);
  });

  // Teams Bot Framework endpoint
  // PUBLIC endpoint - Bot Framework validates with appId/appPassword
  // Security: JWT validation by Bot Framework SDK
  app.post("/api/teams/messages", async (req, res) => {
    await teamsBotAdapter.processActivity(req, res);
  });
  
  // Register admin webhook subscription management endpoints
  // These are AUTHENTICATED endpoints at /api/admin/webhooks/*
  // Only authenticated admins can create/delete webhook subscriptions
  registerAdminWebhookRoutes(app);

  // ========== MEETINGS API ==========
  
  // Get all meetings (filtered by user access)
  // Query params:
  //   - limit: number of meetings per page (default: all)
  //   - offset: starting position for pagination (default: 0)
  //   - includeDismissed: "true" to include dismissed meetings (default: false)
  //   - sort: "date_asc" | "date_desc" | "title_asc" | "title_desc" | "status" (default: date_desc)
  app.get("/api/meetings", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const allMeetings = await storage.getAllMeetings();
      
      // Filter meetings based on user's access level (Azure AD groups or database fallback)
      let accessibleMeetings = accessControlService.filterMeetings(req.user, allMeetings);
      
      // Get user's tenant and email for dismissal filtering
      const tenantId = (req.user as any).tenantId || 'default';
      const userEmail = req.user.email;
      
      // Get dismissed meeting IDs for this user
      const dismissedIds = await storage.getDismissedMeetingIds(tenantId, userEmail);
      const dismissedSet = new Set(dismissedIds);
      
      // Filter out dismissed meetings unless includeDismissed=true
      const includeDismissed = req.query.includeDismissed === 'true';
      
      // Add dismissed flag to each meeting and filter if needed
      const meetingsWithDismissed = accessibleMeetings.map(m => ({
        ...m,
        isDismissed: dismissedSet.has(m.id)
      }));
      
      let filteredMeetings = includeDismissed 
        ? meetingsWithDismissed 
        : meetingsWithDismissed.filter(m => !m.isDismissed);
      
      // Apply sorting
      const sort = (req.query.sort as string) || 'date_desc';
      switch (sort) {
        case 'date_asc':
          filteredMeetings.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
          break;
        case 'date_desc':
          filteredMeetings.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
          break;
        case 'title_asc':
          filteredMeetings.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'title_desc':
          filteredMeetings.sort((a, b) => b.title.localeCompare(a.title));
          break;
        case 'status':
          const statusOrder = { scheduled: 0, in_progress: 1, completed: 2, archived: 3 };
          filteredMeetings.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));
          break;
      }
      
      // Get total count before pagination
      const total = filteredMeetings.length;
      const dismissedCount = meetingsWithDismissed.filter(m => m.isDismissed).length;
      
      // Apply pagination if limit is provided
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      if (limit) {
        filteredMeetings = filteredMeetings.slice(offset, offset + limit);
      }
      
      // Log access with Azure AD group status
      const permissions = accessControlService.getUserPermissions(req.user);
      const authSource = permissions.azureAdGroupsActive ? "Azure AD groups" : "database fallback";
      
      console.log(`[ACCESS] User ${req.user.email} (${permissions.role}/${permissions.clearanceLevel}) viewing ${filteredMeetings.length}/${total} meetings [${authSource}]`);
      
      // Return paginated response with metadata
      res.json({
        meetings: filteredMeetings,
        pagination: {
          total,
          offset,
          limit: limit || total,
          hasMore: limit ? (offset + limit) < total : false
        },
        dismissedCount
      });
    } catch (error: any) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  // Dismiss a meeting for the current user
  app.post("/api/meetings/:id/dismiss", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const meetingId = req.params.id;
      const tenantId = (req.user as any).tenantId || 'default';
      const userEmail = req.user.email;

      // Verify meeting exists and user has access
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Dismiss the meeting
      const dismissed = await storage.dismissMeeting(tenantId, meetingId, userEmail);
      
      console.log(`[DISMISS] User ${userEmail} dismissed meeting ${meetingId}`);
      
      res.json({ 
        success: true, 
        message: "Meeting dismissed",
        dismissedAt: dismissed.dismissedAt
      });
    } catch (error: any) {
      console.error("Error dismissing meeting:", error);
      res.status(500).json({ error: "Failed to dismiss meeting" });
    }
  });

  // Restore a dismissed meeting for the current user
  app.post("/api/meetings/:id/restore", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const meetingId = req.params.id;
      const tenantId = (req.user as any).tenantId || 'default';
      const userEmail = req.user.email;

      // Verify meeting exists
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Restore the meeting
      await storage.restoreMeeting(tenantId, meetingId, userEmail);
      
      console.log(`[RESTORE] User ${userEmail} restored meeting ${meetingId}`);
      
      res.json({ 
        success: true, 
        message: "Meeting restored"
      });
    } catch (error: any) {
      console.error("Error restoring meeting:", error);
      res.status(500).json({ error: "Failed to restore meeting" });
    }
  });

  // Get single meeting (with access control)
  app.get("/api/meetings/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Check if user has access to this meeting
      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        // Log access denial for audit trail
        accessControlService.logAccessAttempt(req.user, meeting, false, "Insufficient clearance or not an attendee");
        return res.status(403).json({ error: "Access denied: Insufficient clearance or not an attendee" });
      }

      // Log successful access with Azure AD group status
      const usingAzureAD = req.user.azureAdGroups ? "Azure AD groups" : "database fallback";
      accessControlService.logAccessAttempt(req.user, meeting, true, `Granted access via ${usingAzureAD}`);
      
      res.json(meeting);
    } catch (error: any) {
      console.error("Error fetching meeting:", error);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  // Create new meeting (admin only or Teams webhook)
  // NOTE: In production, meetings are created via Teams webhooks, not by users
  app.post("/api/meetings", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Only admins can manually create meetings
      // In production, this endpoint would be restricted to webhook callbacks
      if (!accessControlService.isAdmin(req.user)) {
        return res.status(403).json({ 
          error: "Access denied: Only admins can manually create meetings",
          note: "Meetings are normally captured automatically from Teams via webhooks"
        });
      }

      const validatedData = insertMeetingSchema.parse(req.body);

      // Verify admin has clearance to create meeting at requested classification level
      const requestedClassification = validatedData.classificationLevel || "UNCLASSIFIED";
      if (!accessControlService.hasClassificationAccess(req.user, requestedClassification)) {
        return res.status(403).json({ 
          error: "Access denied: Cannot create meeting at classification level above your clearance",
          requestedClassification,
          userClearance: req.user.clearanceLevel
        });
      }

      console.log(`[ACCESS] Admin ${req.user.email} creating ${requestedClassification} meeting`);

      const meeting = await storage.createMeeting(validatedData);
      res.status(201).json(meeting);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid meeting data", details: error.errors });
      }
      console.error("Error creating meeting:", error);
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  // Update meeting (admin only with access verification)
  app.patch("/api/meetings/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Only admins can update meetings
      if (!accessControlService.isAdmin(req.user)) {
        return res.status(403).json({ 
          error: "Access denied: Only admins can update meetings",
          currentRole: req.user.role
        });
      }

      const existingMeeting = await storage.getMeeting(req.params.id);
      if (!existingMeeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Verify admin has clearance to access existing meeting
      if (!accessControlService.hasClassificationAccess(req.user, existingMeeting.classificationLevel)) {
        return res.status(403).json({ 
          error: "Access denied: Insufficient clearance to modify this meeting",
          meetingClassification: existingMeeting.classificationLevel,
          userClearance: req.user.clearanceLevel
        });
      }

      // If updating classification level, verify admin has clearance for NEW level
      if (req.body.classificationLevel) {
        if (!accessControlService.hasClassificationAccess(req.user, req.body.classificationLevel)) {
          return res.status(403).json({ 
            error: "Access denied: Cannot escalate meeting to classification level above your clearance",
            requestedClassification: req.body.classificationLevel,
            userClearance: req.user.clearanceLevel
          });
        }
      }

      console.log(`[ACCESS] Admin ${req.user.email} updating meeting: ${existingMeeting.title}`);

      // STRICT VALIDATION: Validate partial updates against schema
      const validatedData = insertMeetingSchema.partial().parse(req.body);
      const meeting = await storage.updateMeeting(req.params.id, validatedData);
      res.json(meeting);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid meeting data", details: error.errors });
      }
      if (error.message === "Meeting not found") {
        return res.status(404).json({ error: "Meeting not found" });
      }
      console.error("Error updating meeting:", error);
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  // Delete meeting (admin only with access verification)
  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Only admins can delete meetings
      if (!accessControlService.isAdmin(req.user)) {
        return res.status(403).json({ 
          error: "Access denied: Only admins can delete meetings",
          currentRole: req.user.role
        });
      }

      const existingMeeting = await storage.getMeeting(req.params.id);
      if (!existingMeeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Verify admin has clearance to delete this meeting
      if (!accessControlService.hasClassificationAccess(req.user, existingMeeting.classificationLevel)) {
        return res.status(403).json({ 
          error: "Access denied: Insufficient clearance to delete this meeting",
          meetingClassification: existingMeeting.classificationLevel,
          userClearance: req.user.clearanceLevel
        });
      }

      console.log(`[ACCESS] Admin ${req.user.email} deleting meeting: ${existingMeeting.title}`);

      await storage.deleteMeeting(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // ========== MEETING MINUTES API ==========

  // Get all minutes (filtered by user access to meetings)
  app.get("/api/minutes", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const allMinutes = await storage.getAllMinutes();
      
      // Filter minutes based on user's access to associated meetings
      const accessibleMinutes = [];
      for (const minute of allMinutes) {
        const meeting = await storage.getMeeting(minute.meetingId);
        if (meeting && accessControlService.canViewMeeting(req.user, meeting)) {
          accessibleMinutes.push(minute);
        }
      }
      
      console.log(`[ACCESS] User ${req.user.email} viewing ${accessibleMinutes.length}/${allMinutes.length} minutes`);
      res.json(accessibleMinutes);
    } catch (error: any) {
      console.error("Error fetching minutes:", error);
      res.status(500).json({ error: "Failed to fetch minutes" });
    }
  });

  // Get single minutes (with access control)
  app.get("/api/minutes/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const minutes = await storage.getMinutes(req.params.id);
      if (!minutes) {
        return res.status(404).json({ error: "Minutes not found" });
      }

      // Verify user has access to the associated meeting
      const meeting = await storage.getMeeting(minutes.meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Associated meeting not found" });
      }

      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to access minutes without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot view minutes for meetings you cannot access" });
      }

      // Log successful access
      accessControlService.logAccessAttempt(req.user, meeting, true);
      
      res.json(minutes);
    } catch (error: any) {
      console.error("Error fetching minutes:", error);
      res.status(500).json({ error: "Failed to fetch minutes" });
    }
  });

  // Generate minutes for a meeting (with access control)
  app.post("/api/minutes/generate", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId, transcript } = req.body;
      
      if (!meetingId || !transcript) {
        return res.status(400).json({ error: "Meeting ID and transcript are required" });
      }

      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Verify user has access to this meeting
      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to generate minutes without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot generate minutes for meetings you cannot access" });
      }

      console.log(`[ACCESS] User ${req.user.email} generating minutes for meeting: ${meeting.title}`);

      // Create pending minutes record
      const pendingMinutes = await storage.createMinutes({
        meetingId,
        summary: "",
        keyDiscussions: [],
        decisions: [],
        attendeesPresent: meeting.attendees,
        processingStatus: "pending",
        sharepointUrl: null,
        docxUrl: null,
        pdfUrl: null
      });

      // Process asynchronously
      processMinutesAsync(meetingId, pendingMinutes.id, transcript);

      res.status(202).json({
        id: pendingMinutes.id,
        meetingId,
        processingStatus: "pending",
        message: "Minutes generation started"
      });
    } catch (error: any) {
      console.error("Error generating minutes:", error);
      res.status(500).json({ error: "Failed to generate minutes" });
    }
  });

  // Update minutes (with access control)
  app.patch("/api/minutes/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Only approvers and admins can update minutes
      if (!accessControlService.canApproveMinutes(req.user)) {
        return res.status(403).json({ 
          error: "Access denied: Only approvers and admins can update minutes",
          requiredRole: "approver or admin",
          currentRole: req.user.role
        });
      }

      const existingMinutes = await storage.getMinutes(req.params.id);
      if (!existingMinutes) {
        return res.status(404).json({ error: "Minutes not found" });
      }

      // Verify user has access to the associated meeting
      const meeting = await storage.getMeeting(existingMinutes.meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Associated meeting not found" });
      }

      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to update minutes without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot update minutes for meetings you cannot access" });
      }

      console.log(`[ACCESS] User ${req.user.email} (${req.user.role}) updating minutes for meeting: ${meeting.title}`);

      // STRICT VALIDATION: Validate partial updates against schema
      const validatedData = insertMeetingMinutesSchema.partial().parse(req.body);
      const minutes = await storage.updateMinutes(req.params.id, validatedData);
      res.json(minutes);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid minutes data", details: error.errors });
      }
      if (error.message === "Minutes not found") {
        return res.status(404).json({ error: "Minutes not found" });
      }
      console.error("Error updating minutes:", error);
      res.status(500).json({ error: "Failed to update minutes" });
    }
  });

  // Approve minutes (requires approver or admin role)
  // NEW: Uses transactional orchestrator with automatic retry
  app.post("/api/minutes/:id/approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if user has permission to approve
      if (!accessControlService.canApproveMinutes(req.user)) {
        return res.status(403).json({ 
          error: "Access denied: Only approvers and admins can approve minutes",
          requiredRole: "approver or admin",
          currentRole: req.user.role
        });
      }

      const { approvedBy } = req.body;
      if (!approvedBy) {
        return res.status(400).json({ error: "approvedBy is required" });
      }

      const minutes = await storage.getMinutes(req.params.id);
      if (!minutes) {
        return res.status(404).json({ error: "Minutes not found" });
      }

      // Get full meeting details
      const meeting = await storage.getMeeting(minutes.meetingId);
      if (!meeting || !meeting.minutes) {
        return res.status(404).json({ error: "Meeting or minutes not found" });
      }

      // Verify user has access to the associated meeting
      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to approve minutes without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot approve minutes for meetings you cannot access" });
      }

      const permissions = accessControlService.getUserPermissions(req.user);
      const authSource = permissions.azureAdGroupsActive ? "Azure AD groups" : "database fallback";
      console.log(`[APPROVAL] User ${req.user.email} (${permissions.role}) approving minutes for meeting: ${meeting.title} [${authSource}]`);

      // TRANSACTIONAL APPROVAL: Mark as approved FIRST, then enqueue email/SharePoint jobs
      // This ensures approval succeeds even if email/SharePoint fail (they'll retry automatically)
      const updatedMinutes = await storage.updateMinutes(req.params.id, {
        approvalStatus: "approved",
        approvedBy,
        approvedAt: new Date(),
      });

      // Enqueue email and SharePoint jobs (with automatic retry via durable queue)
      const { triggerApprovalWorkflow } = await import("./services/meetingOrchestrator");
      const { emailJobId, sharepointJobId } = await triggerApprovalWorkflow({
        meetingId: meeting.id,
        minutesId: req.params.id,
      });

      console.log(`✅ Minutes ${req.params.id} approved by ${approvedBy}`);
      console.log(`📧 Email job enqueued: ${emailJobId}`);
      console.log(`📤 SharePoint job enqueued: ${sharepointJobId}`);

      // Log the approval event
      await storage.createMeetingEvent({
        meetingId: meeting.id,
        tenantId: (req.user as any).tenantId || null,
        eventType: "minutes_approved",
        title: "Minutes Approved",
        description: `Minutes approved by ${req.user.displayName || req.user.email}. Email and SharePoint distribution jobs have been enqueued.`,
        actorEmail: req.user.email,
        actorName: req.user.displayName || req.user.email,
        actorAadId: req.user.id,
        metadata: { 
          minutesId: req.params.id, 
          emailJobId, 
          sharepointJobId,
          approvalSource: authSource
        },
        correlationId: null,
      });

      res.json({
        ...updatedMinutes,
        workflow: {
          emailJobId,
          sharepointJobId,
          status: "Jobs enqueued for processing"
        }
      });
    } catch (error: any) {
      console.error("Error approving minutes:", error);
      res.status(500).json({ error: "Failed to approve minutes" });
    }
  });

  // Reject minutes (requires approver or admin role)
  app.post("/api/minutes/:id/reject", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Only approvers and admins can reject minutes
      if (!accessControlService.canApproveMinutes(req.user)) {
        return res.status(403).json({ 
          error: "Access denied: Only approvers and admins can reject minutes",
          requiredRole: "approver or admin",
          currentRole: req.user.role
        });
      }

      const { rejectedBy, reason } = req.body;
      if (!rejectedBy || !reason) {
        return res.status(400).json({ error: "rejectedBy and reason are required" });
      }

      const existingMinutes = await storage.getMinutes(req.params.id);
      if (!existingMinutes) {
        return res.status(404).json({ error: "Minutes not found" });
      }

      // Verify user has access to the associated meeting
      const meeting = await storage.getMeeting(existingMinutes.meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Associated meeting not found" });
      }

      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to reject minutes without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot reject minutes for meetings you cannot access" });
      }

      const permissions = accessControlService.getUserPermissions(req.user);
      const authSource = permissions.azureAdGroupsActive ? "Azure AD groups" : "database fallback";
      console.log(`[REJECT] User ${req.user.email} (${permissions.role}) rejecting minutes for meeting: ${meeting.title} [${authSource}]`);

      const updatedMinutes = await storage.updateMinutes(req.params.id, {
        approvalStatus: "rejected",
        approvedBy: rejectedBy,
        approvedAt: new Date(),
        rejectionReason: reason
      });

      // Log the rejection event
      await storage.createMeetingEvent({
        meetingId: meeting.id,
        tenantId: (req.user as any).tenantId || null,
        eventType: "minutes_rejected",
        title: "Minutes Rejected",
        description: `Minutes rejected by ${req.user.displayName || req.user.email}. Reason: ${reason}`,
        actorEmail: req.user.email,
        actorName: req.user.displayName || req.user.email,
        actorAadId: req.user.id,
        metadata: { 
          minutesId: req.params.id, 
          rejectionReason: reason,
          authSource: authSource
        },
        correlationId: null,
      });

      res.json(updatedMinutes);
    } catch (error: any) {
      if (error.message === "Minutes not found") {
        return res.status(404).json({ error: "Minutes not found" });
      }
      console.error("Error rejecting minutes:", error);
      res.status(500).json({ error: "Failed to reject minutes" });
    }
  });

  // Resend email distribution for approved minutes (requires approver or admin role)
  app.post("/api/meetings/:id/resend-email", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Only approvers and admins can resend emails
      if (!accessControlService.canApproveMinutes(req.user)) {
        return res.status(403).json({ 
          error: "Access denied: Only approvers and admins can resend email distribution",
          requiredRole: "approver or admin",
          currentRole: req.user.role
        });
      }

      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Verify meeting has approved minutes
      if (!meeting.minutes || meeting.minutes.approvalStatus !== "approved") {
        return res.status(400).json({ error: "Minutes must be approved before resending email" });
      }

      // Verify user has access to the meeting
      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to resend email without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot resend email for meetings you cannot access" });
      }

      const permissions = accessControlService.getUserPermissions(req.user);
      const authSource = permissions.azureAdGroupsActive ? "Azure AD groups" : "database fallback";
      console.log(`[RESEND EMAIL] User ${req.user.email} (${permissions.role}) resending email for meeting: ${meeting.title} [${authSource}]`);

      // Enqueue email job (with automatic retry via durable queue)
      const { enqueueJob } = await import("./services/durableQueue");
      const emailJobId = await enqueueJob({
        jobType: "send_email",
        idempotencyKey: `resend_email:${meeting.minutes.id}:${Date.now()}`,
        payload: { meetingId: meeting.id, minutesId: meeting.minutes.id },
        maxRetries: 3,
      });

      console.log(`📧 Email resend job enqueued: ${emailJobId}`);

      // Log the resend event
      await storage.createMeetingEvent({
        meetingId: meeting.id,
        tenantId: (req.user as any).tenantId || null,
        eventType: "email_sent",
        title: "Email Distribution Resent",
        description: `Email distribution manually triggered by ${req.user.displayName || req.user.email}`,
        actorEmail: req.user.email,
        actorName: req.user.displayName || req.user.email,
        actorAadId: req.user.id,
        metadata: { 
          meetingId: meeting.id,
          minutesId: meeting.minutes.id,
          emailJobId,
          isResend: true,
          authSource
        },
        correlationId: null,
      });

      res.json({
        success: true,
        emailJobId,
        message: "Email distribution job enqueued successfully"
      });
    } catch (error: any) {
      console.error("Error resending email:", error);
      res.status(500).json({ error: "Failed to resend email distribution" });
    }
  });

  // Request revision for minutes (requires approver or admin role)
  app.post("/api/minutes/:id/request-revision", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Only approvers and admins can request revisions
      if (!accessControlService.canApproveMinutes(req.user)) {
        return res.status(403).json({ 
          error: "Access denied: Only approvers and admins can request revisions",
          requiredRole: "approver or admin",
          currentRole: req.user.role
        });
      }

      const { requestedBy, comments } = req.body;
      if (!requestedBy) {
        return res.status(400).json({ error: "requestedBy is required" });
      }

      const existingMinutes = await storage.getMinutes(req.params.id);
      if (!existingMinutes) {
        return res.status(404).json({ error: "Minutes not found" });
      }

      // Verify user has access to the associated meeting
      const meeting = await storage.getMeeting(existingMinutes.meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Associated meeting not found" });
      }

      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to request revision without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot request revision for meetings you cannot access" });
      }

      console.log(`[ACCESS] User ${req.user.email} (${req.user.role}) requesting revision for meeting: ${meeting.title}`);

      const updatedMinutes = await storage.updateMinutes(req.params.id, {
        approvalStatus: "revision_requested",
        approvedBy: requestedBy,
        approvedAt: new Date(),
        rejectionReason: comments || "Revision requested"
      });

      res.json(updatedMinutes);
    } catch (error: any) {
      if (error.message === "Minutes not found") {
        return res.status(404).json({ error: "Minutes not found" });
      }
      console.error("Error requesting revision:", error);
      res.status(500).json({ error: "Failed to request revision" });
    }
  });

  // ========== MEETING EVENTS API (AUDIT TRAIL) ==========

  // Get meeting event history (with access control)
  app.get("/api/meetings/:id/events", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to view event history without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot view event history for meetings you cannot access" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const events = await storage.getMeetingEvents(req.params.id, { limit, offset });
      res.json(events);
    } catch (error: any) {
      console.error("Error fetching meeting events:", error);
      res.status(500).json({ error: "Failed to fetch meeting events" });
    }
  });

  // Create a meeting event (used by services for audit logging)
  app.post("/api/meetings/:id/events", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to create event without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot create events for meetings you cannot access" });
      }

      // Validate request body with schema
      const eventData = insertMeetingEventSchema.parse({
        ...req.body,
        meetingId: req.params.id,
        tenantId: (req.user as any).tenantId || null,
        actorEmail: req.user.email,
        actorName: req.user.displayName || req.user.email,
        actorAadId: req.user.id,
        metadata: req.body.metadata || {},
      });

      const event = await storage.createMeetingEvent(eventData);

      res.status(201).json(event);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      console.error("Error creating meeting event:", error);
      res.status(500).json({ error: "Failed to create meeting event" });
    }
  });

  // ========== DOCUMENT EXPORT API ==========

  // Export meeting minutes as DOCX (with access control)
  app.get("/api/meetings/:id/export/docx", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Verify user has access to this meeting
      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to export DOCX without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot export minutes for meetings you cannot access" });
      }

      if (!meeting.minutes) {
        return res.status(404).json({ error: "Meeting has no minutes to export" });
      }

      console.log(`[ACCESS] User ${req.user.email} exporting DOCX for meeting: ${meeting.title}`);
      accessControlService.logAccessAttempt(req.user, meeting, true, "DOCX export");

      const templateId = req.query.templateId as string | undefined;
      const buffer = await documentExportService.generateDOCX(meeting, templateId);
      const filename = `meeting-minutes-${meeting.id}-${Date.now()}.docx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error exporting DOCX:", error);
      res.status(500).json({ error: "Failed to export document" });
    }
  });

  // Export meeting minutes as PDF (with access control)
  app.get("/api/meetings/:id/export/pdf", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Verify user has access to this meeting
      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to export PDF without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot export minutes for meetings you cannot access" });
      }

      if (!meeting.minutes) {
        return res.status(404).json({ error: "Meeting has no minutes to export" });
      }

      console.log(`[ACCESS] User ${req.user.email} exporting PDF for meeting: ${meeting.title}`);
      accessControlService.logAccessAttempt(req.user, meeting, true, "PDF export");

      const templateId = req.query.templateId as string | undefined;
      const buffer = await documentExportService.generatePDF(meeting, templateId);
      const filename = `meeting-minutes-${meeting.id}-${Date.now()}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      res.status(500).json({ error: "Failed to export document" });
    }
  });

  // ========== ACTION ITEMS API ==========

  // Get all action items
  app.get("/api/action-items", async (req, res) => {
    try {
      const { meetingId, assignee, status } = req.query;
      let items = await storage.getAllActionItems();

      // Apply filters
      if (meetingId) {
        items = items.filter(item => item.meetingId === meetingId);
      }
      if (assignee) {
        items = items.filter(item => item.assignee === assignee);
      }
      if (status) {
        items = items.filter(item => item.status === status);
      }

      res.json(items);
    } catch (error: any) {
      console.error("Error fetching action items:", error);
      res.status(500).json({ error: "Failed to fetch action items" });
    }
  });

  // Get single action item
  app.get("/api/action-items/:id", async (req, res) => {
    try {
      const item = await storage.getActionItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Action item not found" });
      }
      res.json(item);
    } catch (error: any) {
      console.error("Error fetching action item:", error);
      res.status(500).json({ error: "Failed to fetch action item" });
    }
  });

  // Create action item
  app.post("/api/action-items", async (req, res) => {
    try {
      const validatedData = insertActionItemSchema.parse(req.body);
      const item = await storage.createActionItem(validatedData);
      res.status(201).json(item);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid action item data", details: error.errors });
      }
      console.error("Error creating action item:", error);
      res.status(500).json({ error: "Failed to create action item" });
    }
  });

  // Update action item
  app.patch("/api/action-items/:id", async (req, res) => {
    try {
      // STRICT VALIDATION: Validate partial updates against schema
      const validatedData = insertActionItemSchema.partial().parse(req.body);
      
      // First check if item exists (return 404 before permission check)
      const existingItem = await storage.getActionItem(req.params.id);
      if (!existingItem) {
        return res.status(404).json({ error: "Action item not found" });
      }
      
      // Permission check: Only assignee, organizer, or admin can update
      const permissionResult = await canManageActionItem(
        {
          id: req.user?.id || "",
          email: req.user?.email || "",
          displayName: req.user?.displayName || "",
          role: req.user?.role || "user",
        },
        req.params.id
      );
      
      if (!permissionResult.allowed) {
        console.log(`🚫 [ActionItem] Access denied for user ${req.user?.email}: ${permissionResult.reason}`);
        return res.status(403).json({ 
          error: "You don't have permission to update this action item",
          reason: permissionResult.reason 
        });
      }
      
      console.log(`✅ [ActionItem] Access granted for user ${req.user?.email}: ${permissionResult.reason}`);
      
      const item = await storage.updateActionItem(req.params.id, validatedData);
      
      // Log event if status changed
      if (validatedData.status && validatedData.status !== existingItem.status) {
        const eventType = validatedData.status === "completed" ? "action_item_completed" : "action_item_updated";
        const eventTitle = validatedData.status === "completed" 
          ? "Action Item Completed" 
          : `Action Item Status Changed to ${validatedData.status.replace('_', ' ')}`;
        
        await storage.createMeetingEvent({
          meetingId: existingItem.meetingId,
          tenantId: null,
          eventType,
          title: eventTitle,
          description: `Action item "${existingItem.task.substring(0, 50)}${existingItem.task.length > 50 ? '...' : ''}" status changed from ${existingItem.status} to ${validatedData.status}`,
          actorEmail: req.user?.email || "system",
          actorName: req.user?.displayName || req.user?.email || "System",
          actorAadId: req.user?.id || null,
          metadata: { 
            actionItemId: req.params.id,
            oldStatus: existingItem.status,
            newStatus: validatedData.status,
            assignee: existingItem.assignee
          },
          correlationId: null,
        });
      }
      
      res.json(item);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid action item data", details: error.errors });
      }
      if (error.message === "Action item not found") {
        return res.status(404).json({ error: "Action item not found" });
      }
      console.error("Error updating action item:", error);
      res.status(500).json({ error: "Failed to update action item" });
    }
  });

  // Delete action item
  app.delete("/api/action-items/:id", async (req, res) => {
    try {
      await storage.deleteActionItem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting action item:", error);
      res.status(500).json({ error: "Failed to delete action item" });
    }
  });

  // ========== STATS API ==========

  app.get("/api/stats", async (_req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      const allMinutes = await storage.getAllMinutes();
      const actionItems = await storage.getAllActionItems();

      const stats = {
        totalMeetings: meetings.length,
        pendingMinutes: allMinutes.filter(m => m.processingStatus === "pending").length,
        completedMeetings: meetings.filter(m => m.status === "completed").length,
        archivedMeetings: allMinutes.filter(m => m.sharepointUrl !== null).length,
        actionItems: {
          total: actionItems.length,
          pending: actionItems.filter(a => a.status === "pending").length,
          inProgress: actionItems.filter(a => a.status === "in_progress").length,
          completed: actionItems.filter(a => a.status === "completed").length
        }
      };

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // ========== SEARCH API ==========

  app.get("/api/search", async (req, res) => {
    try {
      const { q, classificationLevel, from, to } = req.query;
      
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Search query (q) is required" });
      }

      const meetings = await storage.getAllMeetings();
      const query = q.toLowerCase();

      let results = meetings.filter(meeting => {
        // Text search
        const matchesText = 
          meeting.title.toLowerCase().includes(query) ||
          (meeting.description?.toLowerCase().includes(query)) ||
          (meeting.minutes?.summary?.toLowerCase().includes(query));

        // Classification filter
        const matchesClassification = !classificationLevel || meeting.classificationLevel === classificationLevel;

        // Date filters
        const meetingDate = new Date(meeting.scheduledAt);
        const matchesFrom = !from || meetingDate >= new Date(from as string);
        const matchesTo = !to || meetingDate <= new Date(to as string);

        return matchesText && matchesClassification && matchesFrom && matchesTo;
      });

      res.json(results);
    } catch (error: any) {
      console.error("Error searching:", error);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  // ========== MEETING TEMPLATES API ==========

  // Get all templates
  app.get("/api/templates", async (_req, res) => {
    try {
      const templates = await storage.getAllTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Get system templates only
  app.get("/api/templates/system", async (_req, res) => {
    try {
      const templates = await storage.getSystemTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching system templates:", error);
      res.status(500).json({ error: "Failed to fetch system templates" });
    }
  });

  // Get single template
  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("Error fetching template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // Create template
  app.post("/api/templates", async (req, res) => {
    try {
      const validatedData = insertMeetingTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(validatedData);
      res.status(201).json(template);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Update template
  app.patch("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.updateTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error: any) {
      if (error.message === "Template not found") {
        return res.status(404).json({ error: "Template not found" });
      }
      console.error("Error updating template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  // Delete template
  app.delete("/api/templates/:id", async (req, res) => {
    try {
      await storage.deleteTemplate(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Create meeting from template
  app.post("/api/templates/:id/create-meeting", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const { scheduledAt, attendees, title } = req.body;
      if (!scheduledAt || !attendees) {
        return res.status(400).json({ error: "scheduledAt and attendees are required" });
      }

      const meeting = await storage.createMeeting({
        title: title || template.name,
        description: template.description || undefined,
        scheduledAt: new Date(scheduledAt),
        duration: template.defaultDuration,
        attendees,
        status: "scheduled",
        classificationLevel: template.defaultClassification,
        recordingUrl: null,
        transcriptUrl: null
      });

      res.status(201).json(meeting);
    } catch (error: any) {
      console.error("Error creating meeting from template:", error);
      res.status(500).json({ error: "Failed to create meeting from template" });
    }
  });

  // ========== DOCUMENT TEMPLATES API ==========
  // Templates for visual presentation of meeting minutes (DOCX/PDF export)

  // Get all document templates
  app.get("/api/document-templates", async (_req, res) => {
    try {
      const templates = await templateService.getAllTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching document templates:", error);
      res.status(500).json({ error: "Failed to fetch document templates" });
    }
  });

  // Get default document template
  app.get("/api/document-templates/default", async (_req, res) => {
    try {
      const template = await templateService.getDefaultTemplate();
      if (!template) {
        return res.status(404).json({ error: "No default template found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("Error fetching default document template:", error);
      res.status(500).json({ error: "Failed to fetch default document template" });
    }
  });

  // Get default config (for creating new templates)
  app.get("/api/document-templates/default-config", async (_req, res) => {
    try {
      const config = templateService.getDefaultConfig();
      res.json(config);
    } catch (error: any) {
      console.error("Error fetching default config:", error);
      res.status(500).json({ error: "Failed to fetch default config" });
    }
  });

  // Get single document template
  app.get("/api/document-templates/:id", async (req, res) => {
    try {
      const template = await templateService.getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("Error fetching document template:", error);
      res.status(500).json({ error: "Failed to fetch document template" });
    }
  });

  // Create document template (admin only)
  app.post("/api/document-templates", requireRole("admin"), async (req, res) => {
    try {
      const { name, description, config } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Template name is required" });
      }

      const template = await templateService.createTemplate({ name, description, config });
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Error creating document template:", error);
      res.status(500).json({ error: "Failed to create document template" });
    }
  });

  // Update document template (admin only)
  app.patch("/api/document-templates/:id", requireRole("admin"), async (req, res) => {
    try {
      const template = await templateService.updateTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("Error updating document template:", error);
      res.status(500).json({ error: "Failed to update document template" });
    }
  });

  // Delete document template (admin only)
  app.delete("/api/document-templates/:id", requireRole("admin"), async (req, res) => {
    try {
      await templateService.deleteTemplate(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error.message === "Cannot delete system templates") {
        return res.status(403).json({ error: "Cannot delete system templates" });
      }
      console.error("Error deleting document template:", error);
      res.status(500).json({ error: "Failed to delete document template" });
    }
  });

  // Set default document template (admin only)
  app.post("/api/document-templates/:id/set-default", requireRole("admin"), async (req, res) => {
    try {
      const success = await templateService.setDefaultTemplate(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Document template not found" });
      }
      res.json({ success: true, message: "Default template updated" });
    } catch (error: any) {
      console.error("Error setting default document template:", error);
      res.status(500).json({ error: "Failed to set default document template" });
    }
  });

  // Duplicate document template (admin only)
  app.post("/api/document-templates/:id/duplicate", requireRole("admin"), async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "New template name is required" });
      }

      const template = await templateService.duplicateTemplate(req.params.id, name);
      if (!template) {
        return res.status(404).json({ error: "Document template not found" });
      }
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Error duplicating document template:", error);
      res.status(500).json({ error: "Failed to duplicate document template" });
    }
  });

  // ========== USER & PERMISSIONS API ==========

  // Get current user info and permissions
  app.get("/api/user/me", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const permissions = accessControlService.getUserPermissions(req.user);
      
      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          displayName: req.user.displayName,
          role: req.user.role,
          clearanceLevel: req.user.clearanceLevel,
          department: req.user.department,
          organizationalUnit: req.user.organizationalUnit,
        },
        permissions
      });
    } catch (error: any) {
      console.error("Error fetching user info:", error);
      res.status(500).json({ error: "Failed to fetch user info" });
    }
  });

  // ========== APPLICATION SETTINGS API ==========

  // Get application settings
  app.get("/api/settings", requireRole("admin"), async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Update application settings (admin only)
  app.patch("/api/settings", requireRole("admin"), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate request body using partial schema
      const validatedUpdates = insertAppSettingsSchema.partial().parse(req.body);

      const settings = await storage.updateSettings({
        ...validatedUpdates,
        updatedBy: req.user.azureAdId || req.user.id
      });

      console.log(`[SETTINGS] Updated by ${req.user.email}:`, validatedUpdates);
      
      res.json(settings);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Invalid settings data", 
          details: error.errors 
        });
      }
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ========== CALENDAR SYNC API ==========

  // Trigger calendar sync from Microsoft Graph (pulls Teams meetings from user's calendar)
  app.post("/api/calendar/sync", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      console.log(`[CalendarSync] Manual sync requested by ${req.user.email}`);

      // Get user's Azure AD ID for Graph API call
      const userId = req.user.azureAdId || req.user.id;
      const userEmail = req.user.email;
      
      // Pass SSO token for On-Behalf-Of flow (delegated permissions)
      const ssoToken = req.ssoToken;

      const result = await graphCalendarSync.syncUserCalendar(userEmail, userId, ssoToken);

      res.json({
        success: true,
        message: `Synced ${result.synced} meetings (${result.created} new, ${result.updated} updated)`,
        details: result,
      });
    } catch (error: any) {
      console.error("[CalendarSync] Sync failed:", error);
      res.status(500).json({ 
        error: "Calendar sync failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get calendar sync status
  app.get("/api/calendar/sync/status", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const status = await graphCalendarSync.getSyncStatus();
      res.json(status);
    } catch (error: any) {
      console.error("[CalendarSync] Status check failed:", error);
      res.status(500).json({ error: "Failed to get sync status" });
    }
  });

  // Admin: Sync all users' calendars
  app.post("/api/admin/calendar/sync-all", requireRole("admin"), async (req, res) => {
    try {
      console.log(`[CalendarSync] Admin sync-all requested by ${req.user?.email}`);
      
      const result = await graphCalendarSync.syncAllUsersCalendars();
      
      res.json({
        success: true,
        message: `Synced ${result.totalSynced} meetings across all users`,
        totalSynced: result.totalSynced,
        totalErrors: result.totalErrors,
        userResults: result.userResults,
      });
    } catch (error: any) {
      console.error("[CalendarSync] Sync-all failed:", error);
      res.status(500).json({ error: "Calendar sync failed" });
    }
  });

  // Admin: Force reprocess a meeting (regenerate minutes)
  app.post("/api/admin/meetings/:id/reprocess", requireRole("admin"), async (req, res) => {
    try {
      const meetingId = req.params.id;
      console.log(`[Admin] Reprocess meeting ${meetingId} requested by ${req.user?.email}`);
      
      // Get meeting to verify it exists
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      
      // Reset meeting status for reprocessing
      const { meetings: meetingsTable, meetingMinutes } = await import("@shared/schema");
      
      // Check if meeting has transcript content (required for processing)
      // No minimum length - just needs to exist
      if (!meeting.transcriptContent || meeting.transcriptContent.trim().length === 0) {
        return res.status(400).json({ 
          error: "Cannot reprocess: Meeting has no transcript content",
          hint: "Transcript is required for AI minutes generation" 
        });
      }
      
      // Delete existing minutes if any (so we can regenerate)
      await db.delete(meetingMinutes).where(eq(meetingMinutes.meetingId, meetingId));
      
      // Set status to in_progress during regeneration
      await db.update(meetingsTable)
        .set({
          enrichmentStatus: "enriched",
          processingDecision: null,
          processingDecisionReason: null,
          processingDecisionAt: null,
          status: "in_progress"
        })
        .where(eq(meetingsTable.id, meetingId));
      
      // Trigger minutes generation directly
      const { minutesGeneratorService } = await import("./services/minutesGenerator");
      
      try {
        await minutesGeneratorService.autoGenerateMinutes(meetingId);
        
        // Update status to completed after successful generation
        await db.update(meetingsTable)
          .set({ status: "completed" })
          .where(eq(meetingsTable.id, meetingId));
        
        res.json({
          success: true,
          message: `Meeting ${meetingId} has been reprocessed and minutes regenerated`,
          meetingId
        });
      } catch (genError: any) {
        // Update status to indicate failure
        await db.update(meetingsTable)
          .set({ status: "completed" }) // Keep as completed since enrichment worked
          .where(eq(meetingsTable.id, meetingId));
        
        throw genError;
      }
    } catch (error: any) {
      console.error("[Admin] Reprocess meeting failed:", error);
      res.status(500).json({ 
        error: "Failed to reprocess meeting",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========== DEMO/TESTING ENDPOINTS (Mock Mode) ==========

  // Get list of available mock users (development only)
  app.get("/api/dev/mock-users", async (req, res) => {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const useMockServices = process.env.USE_MOCK_SERVICES === 'true' || 
                              (process.env.USE_MOCK_SERVICES === undefined && !isProduction);
      if (!useMockServices) {
        return res.status(400).json({ 
          error: "Mock users only available in development mode" 
        });
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const mockUsersPath = path.join(process.cwd(), "config", "mockUsers.json");
      const mockUsersData = await fs.readFile(mockUsersPath, "utf-8");
      const mockUsers = JSON.parse(mockUsersData);

      res.json(mockUsers.users);
    } catch (error: any) {
      console.error("Error fetching mock users:", error);
      res.status(500).json({ error: "Failed to fetch mock users" });
    }
  });

  // Switch to a different mock user (development only)
  app.post("/api/dev/switch-user", async (req, res) => {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const useMockServices = process.env.USE_MOCK_SERVICES === 'true' || 
                              (process.env.USE_MOCK_SERVICES === undefined && !isProduction);
      if (!useMockServices) {
        return res.status(400).json({ 
          error: "User switching only available in development mode" 
        });
      }

      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const mockUsersPath = path.join(process.cwd(), "config", "mockUsers.json");
      const mockUsersData = await fs.readFile(mockUsersPath, "utf-8");
      const mockUsers = JSON.parse(mockUsersData);

      const user = mockUsers.users.find((u: any) => u.email === email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Ensure user exists in database (same logic as authenticateWithMock)
      let [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (!dbUser) {
        const [newUser] = await db
          .insert(users)
          .values({
            email: user.email,
            displayName: user.displayName,
            clearanceLevel: user.clearanceLevel as "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET",
            role: user.role as "admin" | "approver" | "auditor" | "viewer",
            department: user.department,
            organizationalUnit: user.organizationalUnit,
            azureAdId: user.azureAdId,
            azureUserPrincipalName: user.azureUserPrincipalName,
            tenantId: user.tenantId,
            lastLogin: new Date(),
          })
          .onConflictDoUpdate({
            target: users.email,
            set: {
              displayName: user.displayName,
              clearanceLevel: user.clearanceLevel as "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET",
              role: user.role as "admin" | "approver" | "auditor" | "viewer",
              lastLogin: new Date(),
            }
          })
          .returning();
        dbUser = newUser;
      }

      // Update session with new user ID (matches authenticateWithMock behavior)
      if (req.session) {
        req.session.userId = dbUser.id;
        
        // Clear any cached Azure AD groups so they're refreshed
        delete req.session.azureAdGroups;

        await new Promise<void>((resolve, reject) => {
          req.session!.save((err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });

        console.log(`🔄 [DEV] User switched to: ${user.displayName} (${user.email}) - Role: ${user.role}`);
      }

      res.json({ 
        success: true,
        user: {
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        }
      });
    } catch (error: any) {
      console.error("Error switching user:", error);
      res.status(500).json({ error: "Failed to switch user" });
    }
  });

  // Trigger mock webhook workflow (simulate Teams meeting completion)
  app.post("/api/demo/trigger-webhook/:meetingId", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const isProduction = process.env.NODE_ENV === 'production';
      const useMockServices = process.env.USE_MOCK_SERVICES === 'true' || 
                              (process.env.USE_MOCK_SERVICES === undefined && !isProduction);
      if (!useMockServices) {
        return res.status(400).json({ 
          error: "Demo endpoint only available in mock mode",
          hint: "Set USE_MOCK_SERVICES=true in development only" 
        });
      }

      const meeting = await storage.getMeeting(req.params.meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Simulate webhook event - trigger enrichment workflow
      const mockOnlineMeetingId = `mock-online-meeting-${meeting.id}`;
      
      console.log(`🧪 [DEMO] Simulating Teams meeting completion webhook for ${meeting.id}`);
      console.log(`🧪 [DEMO] This will trigger: enrichment → AI minutes generation → pending review status`);
      
      // Update meeting status to in_progress first
      await storage.updateMeeting(meeting.id, {
        status: "in_progress",
        graphSyncStatus: "pending"
      });

      // Enqueue for enrichment (will auto-generate minutes in mock mode)
      await enqueueMeetingEnrichment(meeting.id, mockOnlineMeetingId);

      res.json({
        message: "Mock webhook triggered successfully",
        meetingId: meeting.id,
        workflow: [
          "1. Meeting marked as in_progress",
          "2. Enrichment queued (mock mode)",
          "3. Minutes will be auto-generated with AI",
          "4. Meeting status will change to completed with pending_review minutes"
        ],
        expectedDuration: "5-10 seconds",
        tip: "Refresh the dashboard to see the new meeting minutes appear"
      });
    } catch (error: any) {
      console.error("Error triggering mock webhook:", error);
      res.status(500).json({ error: "Failed to trigger mock webhook" });
    }
  });

  // ========== OUTBOX TESTING ENDPOINTS (DEBUG/DEV ONLY) ==========
  
  /**
   * Test endpoint to manually trigger outbox messages
   * This simulates the entire flow: stage message → background processing → delivery
   */
  app.post("/api/debug/outbox/test", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { meetingId, simulateFailure } = req.body;

      // Get or create a test meeting
      let meeting;
      if (meetingId) {
        meeting = await storage.getMeeting(meetingId);
        if (!meeting) {
          return res.status(404).json({ error: "Meeting not found" });
        }
      } else {
        // Create a test meeting
        const testMeeting = await storage.createMeeting({
          title: `Outbox Test Meeting - ${new Date().toISOString()}`,
          scheduledAt: new Date(),
          duration: "1h",
          attendees: [req.user.email],
          status: "completed",
          organizerAadId: req.user.azureAdId || "test-organizer",
        });
        meeting = testMeeting;

        // Create test minutes
        await storage.createMinutes({
          meetingId: meeting.id,
          summary: "This is a test meeting summary for outbox testing",
          keyDiscussions: ["Testing outbox pattern", "Verifying exactly-once delivery"],
          decisions: ["Implement proper retry logic"],
          attendeesPresent: [req.user.email],
          approvalStatus: "approved",
          processingStatus: "completed",
        });
      }

      const minutes = await storage.getMinutesByMeetingId(meeting.id);
      if (!minutes) {
        return res.status(400).json({ error: "Meeting has no minutes" });
      }

      // Import messaging service
      const { teamsProactiveMessaging } = await import("./services/teamsProactiveMessaging");

      console.log(`🧪 [OUTBOX TEST] Triggering notification for meeting: ${meeting.id}`);
      
      // This will stage messages in the outbox
      await teamsProactiveMessaging.notifyMeetingProcessed(meeting, minutes);

      res.json({
        success: true,
        message: "Outbox messages staged successfully",
        meetingId: meeting.id,
        minutesId: minutes.id,
        nextSteps: [
          "1. Messages are now in the message_outbox table",
          "2. Background worker will process them in the next poll cycle (5 seconds)",
          "3. Check /api/debug/outbox/status for current state",
          "4. Check server logs for '[Outbox]' messages"
        ],
        testQueries: {
          checkOutbox: "SELECT * FROM message_outbox ORDER BY created_at DESC LIMIT 5",
          checkSentMessages: "SELECT * FROM sent_messages ORDER BY created_at DESC LIMIT 5",
        }
      });
    } catch (error: any) {
      console.error("Error testing outbox:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get current outbox status (pending, sent, failed messages)
   */
  app.get("/api/debug/outbox/status", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { db } = await import("./db");
      const { messageOutbox, sentMessages } = await import("@shared/schema");
      const { sql } = await import("drizzle-orm");

      // Get outbox statistics
      const outboxStats = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE attempt_count = 0) as pending,
          COUNT(*) FILTER (WHERE attempt_count > 0 AND attempt_count < 4) as retrying,
          COUNT(*) FILTER (WHERE next_attempt_at > NOW()) as scheduled,
          AVG(attempt_count) as avg_attempts
        FROM message_outbox
      `);

      // Get sent message statistics
      const sentStats = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'sent') as sent,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status = 'staged') as staged
        FROM sent_messages
      `);

      // Get recent outbox messages
      const recentOutbox = await db.execute(sql`
        SELECT 
          mo.id,
          mo.attempt_count,
          mo.last_attempt_at,
          mo.next_attempt_at,
          mo.last_error,
          mo.created_at,
          sm.idempotency_key,
          sm.status as sent_status,
          sm.message_type
        FROM message_outbox mo
        JOIN sent_messages sm ON sm.id = mo.sent_message_id
        ORDER BY mo.created_at DESC
        LIMIT 10
      `);

      // Get recent sent messages
      const recentSent = await db.execute(sql`
        SELECT 
          id,
          idempotency_key,
          meeting_id,
          conversation_id,
          message_type,
          status,
          attempt_count,
          created_at,
          sent_at
        FROM sent_messages
        WHERE status = 'sent'
        ORDER BY sent_at DESC
        LIMIT 10
      `);

      // Get recent failures (dead-letter)
      const recentFailures = await db.execute(sql`
        SELECT 
          id,
          idempotency_key,
          meeting_id,
          message_type,
          status,
          attempt_count,
          created_at
        FROM sent_messages
        WHERE status = 'failed'
        ORDER BY created_at DESC
        LIMIT 10
      `);

      res.json({
        timestamp: new Date().toISOString(),
        statistics: {
          outbox: outboxStats.rows[0],
          sent: sentStats.rows[0],
        },
        recentMessages: {
          outbox: recentOutbox.rows,
          sent: recentSent.rows,
          failures: recentFailures.rows,
        },
        retrySchedule: {
          attempt1to2: "1 minute",
          attempt2to3: "5 minutes",
          attempt3to4: "15 minutes",
          attempt4: "Dead-letter (no more retries)",
        }
      });
    } catch (error: any) {
      console.error("Error fetching outbox status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Force process outbox messages (trigger worker manually)
   */
  app.post("/api/debug/outbox/process", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { processOutboxMessages } = await import("./services/outboxProcessor");
      
      console.log(`🧪 [OUTBOX TEST] Manual trigger requested by ${req.user.email}`);
      
      const processed = await processOutboxMessages(10);

      res.json({
        success: true,
        processed,
        message: processed > 0 
          ? `Processed ${processed} messages from outbox`
          : "No messages to process",
        nextCheck: "Check /api/debug/outbox/status for updated state"
      });
    } catch (error: any) {
      console.error("Error processing outbox:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== HELP SYSTEM API ==========
  
  // Rate limiting store for help requests (in-memory, reset on restart)
  const helpRequestRateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  const RATE_LIMIT_MAX_REQUESTS = 5;
  const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  
  // Submit help request - sends email to support
  app.post("/api/help/request", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userEmail = req.user.email;
      const now = Date.now();
      
      // Rate limiting check
      const userLimit = helpRequestRateLimits.get(userEmail);
      if (userLimit) {
        if (now < userLimit.resetTime) {
          if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
            console.warn(`[Help Request] Rate limit exceeded for ${userEmail}`);
            return res.status(429).json({ 
              error: "Too many requests. Please try again later.",
              retryAfter: Math.ceil((userLimit.resetTime - now) / 1000 / 60) + " minutes"
            });
          }
          userLimit.count++;
        } else {
          // Reset window
          helpRequestRateLimits.set(userEmail, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        }
      } else {
        helpRequestRateLimits.set(userEmail, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      }

      // Validate and sanitize input
      const rawSubject = req.body.subject;
      const rawCategory = req.body.category;
      const rawDescription = req.body.description;
      
      // Type and length validation
      if (typeof rawSubject !== 'string' || typeof rawDescription !== 'string') {
        return res.status(400).json({ error: "Subject and description must be strings" });
      }
      
      if (rawSubject.length < 3 || rawSubject.length > 200) {
        return res.status(400).json({ error: "Subject must be between 3 and 200 characters" });
      }
      
      if (rawDescription.length < 10 || rawDescription.length > 4000) {
        return res.status(400).json({ error: "Description must be between 10 and 4000 characters" });
      }
      
      // Sanitize: Strip HTML tags and trim whitespace
      const stripHtml = (str: string) => str.replace(/<[^>]*>/g, '').trim();
      const subject = stripHtml(rawSubject).substring(0, 200);
      const description = stripHtml(rawDescription).substring(0, 4000);
      const validCategories = ['general', 'bug', 'feature', 'access'];
      const category = validCategories.includes(rawCategory) ? rawCategory : 'general';
      
      if (!subject || !description) {
        return res.status(400).json({ error: "Subject and description are required" });
      }
      
      // Log the support request
      console.log(`[Help Request] New request from ${userEmail}: ${subject} (${category})`);

      // Create event for audit trail
      try {
        // For now, just log and return success
        // In production, this would send an email via Graph API
        console.log(`[Help Request] Details:
          User: ${userEmail}
          Subject: ${subject}
          Category: ${category}
          Description: ${description.substring(0, 200)}...
        `);

        // If email distribution service is configured, send notification
        // This is optional - if not configured, the request is just logged
        if (process.env.SUPPORT_EMAIL) {
          try {
            await emailDistributionService.sendSupportRequest({
              userEmail,
              userName: req.user.displayName,
              subject,
              category,
              description
            });
            console.log(`[Help Request] Email sent to ${process.env.SUPPORT_EMAIL}`);
          } catch (emailError) {
            console.warn("[Help Request] Could not send email notification:", emailError);
            // Don't fail the request if email fails
          }
        }
      } catch (error) {
        console.error("[Help Request] Error processing request:", error);
      }

      res.json({ 
        success: true, 
        message: "Support request submitted successfully",
        requestId: `HR-${Date.now()}`
      });
    } catch (error: any) {
      console.error("Error submitting help request:", error);
      res.status(500).json({ error: error.message || "Failed to submit request" });
    }
  });

  // CRITICAL: Set up static file serving for production AFTER all API/webhook routes
  // This ensures webhook routes are matched before the catch-all SPA middleware
  // In development, Vite handles this via setupVite in index.ts
  if (process.env.NODE_ENV === "production") {
    console.log("[Routes] Setting up production static file serving...");
    setupProductionStatic(app);
  }

  return httpServer;
}

// Async processing function
async function processMinutesAsync(meetingId: string, minutesId: string, transcript: string) {
  try {
    // Generate minutes using AI
    const generatedMinutes = await generateMeetingMinutes(transcript);
    
    // Extract action items
    const actionItems = await extractActionItems(transcript);

    // Update minutes with generated content
    await storage.updateMinutes(minutesId, {
      summary: generatedMinutes.summary,
      keyDiscussions: generatedMinutes.keyDiscussions,
      decisions: generatedMinutes.decisions,
      processingStatus: "completed"
    });

    // Create action items
    for (const item of actionItems) {
      await storage.createActionItem({
        meetingId,
        minutesId,
        task: item.task,
        assignee: item.assignee || "Unassigned",
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        priority: item.priority as "low" | "medium" | "high",
        status: "pending"
      });
    }

    // Update meeting status
    await storage.updateMeeting(meetingId, { status: "completed" });

    console.log(`✓ Successfully processed minutes for meeting ${meetingId}`);
  } catch (error) {
    console.error(`✗ Failed to process minutes for meeting ${meetingId}:`, error);
    
    // Update minutes to failed status
    await storage.updateMinutes(minutesId, {
      processingStatus: "failed"
    });
  }
}
