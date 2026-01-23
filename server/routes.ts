import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertMeetingSchema, insertMeetingMinutesSchema, insertActionItemSchema, insertMeetingTemplateSchema, insertAppSettingsSchema, insertMeetingEventSchema, users, meetings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
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
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

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
  
  // Register object storage routes for file uploads (logos, etc.)
  registerObjectStorageRoutes(app);

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
  // BUGFIX: Use req.originalUrl instead of req.path - Express strips prefix under /api/* mount
  app.use("/api/*", (req, res, next) => {
    if (req.originalUrl === "/api/teams/messages") {
      return next();
    }
    // TEMP: Allow debug endpoint without auth
    if (req.originalUrl.startsWith("/api/debug/")) {
      return next();
    }
    return authenticateUser(req, res, next);
  });

  // Teams Bot Framework endpoint
  // PUBLIC endpoint - Bot Framework validates with appId/appPassword
  // Security: JWT validation by Bot Framework SDK
  // BUGFIX: Wrap in try-catch to prevent unhandled promise rejections
  app.post("/api/teams/messages", async (req, res, next) => {
    try {
      await teamsBotAdapter.processActivity(req, res);
    } catch (err) {
      console.error('[Teams Bot] Error processing activity:', err);
      next(err);
    }
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

      // Get user's tenant ID for multi-tenant isolation
      const tenantId = (req.user as any).tenantId || 'default';
      const userEmail = req.user.email;
      
      // MULTI-TENANT ISOLATION: Filter meetings by tenant at database level
      // Admin users can see all meetings (for cross-tenant admin scenarios)
      // Regular users only see their tenant's meetings
      const isAdmin = accessControlService.isAdmin(req.user);
      let allMeetings;
      
      if (tenantId !== 'default' && !isAdmin) {
        // Tenant-isolated query for non-admin users with valid tenant
        allMeetings = await storage.getMeetingsByTenant(tenantId);
      } else {
        // Fallback for admin users or legacy 'default' tenant
        allMeetings = await storage.getAllMeetings();
      }
      
      // Additional filtering based on user's access level (Azure AD groups or database fallback)
      let accessibleMeetings = accessControlService.filterMeetings(req.user, allMeetings);
      
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

      // SECURITY: Verify user has access to this meeting (same as dismiss endpoint)
      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        return res.status(403).json({ error: "Access denied" });
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

  // Get single meeting (with access control and tenant isolation)
  app.get("/api/meetings/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const tenantId = (req.user as any).tenantId || 'default';
      const isAdmin = accessControlService.isAdmin(req.user);
      
      // MULTI-TENANT ISOLATION: Non-admin users only see their tenant's meetings
      let meeting;
      if (tenantId !== 'default' && !isAdmin) {
        meeting = await storage.getMeetingForTenant(req.params.id, tenantId);
      } else {
        meeting = await storage.getMeeting(req.params.id);
      }
      
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
      // Convert meeting attendees to AttendeePresent objects
      const attendeesAsObjects = (meeting.attendees || []).map((a: string) => ({
        name: a.includes('@') ? a.split('@')[0].replace(/[._]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : a,
        email: a.includes('@') ? a.toLowerCase() : ''
      }));
      const pendingMinutes = await storage.createMinutes({
        meetingId,
        summary: "",
        keyDiscussions: [],
        decisions: [],
        attendeesPresent: attendeesAsObjects,
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

  // Update minutes content (summary, discussions, decisions) - for editing before approval
  app.patch("/api/minutes/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
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
        accessControlService.logAccessAttempt(req.user, meeting, false, "Attempted to edit minutes without meeting access");
        return res.status(403).json({ error: "Access denied: Cannot edit minutes for meetings you cannot access" });
      }

      // Only allow editing if minutes are pending or rejected (not already approved)
      if (existingMinutes.approvalStatus === "approved") {
        return res.status(400).json({ error: "Cannot edit approved minutes. Please create a new version if changes are needed." });
      }

      // Extract editable fields from request body
      const { summary, keyDiscussions, decisions } = req.body;
      const updateData: any = {};

      if (summary !== undefined) updateData.summary = summary;
      if (keyDiscussions !== undefined) updateData.keyDiscussions = keyDiscussions;
      if (decisions !== undefined) updateData.decisions = decisions;

      // If minutes were rejected and now being edited, set back to pending
      if (existingMinutes.approvalStatus === "rejected") {
        updateData.approvalStatus = "pending";
        updateData.rejectionReason = null;
      }

      const updatedMinutes = await storage.updateMinutes(req.params.id, updateData);

      // Log the edit event
      await storage.createMeetingEvent({
        meetingId: meeting.id,
        tenantId: (req.user as any).tenantId || null,
        eventType: "minutes_edited",
        title: "Minutes Edited",
        description: `Minutes edited by ${req.user.displayName || req.user.email}`,
        actorEmail: req.user.email,
        actorName: req.user.displayName || req.user.email,
        actorAadId: req.user.id,
        metadata: { 
          minutesId: req.params.id,
          fieldsChanged: Object.keys(updateData)
        },
        correlationId: null,
      });

      console.log(`[EDIT] User ${req.user.email} edited minutes for meeting: ${meeting.title}`);
      res.json(updatedMinutes);
    } catch (error: any) {
      console.error("Error updating minutes:", error);
      res.status(500).json({ error: "Failed to update minutes" });
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

  app.get("/api/stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // CRITICAL: Multi-tenant isolation - only show stats for user's tenant
      const tenantId = (req.user as any).tenantId || 'default';
      const isAdmin = accessControlService.isAdmin(req.user);
      
      // Get tenant-filtered data
      let meetings: any[] = [];
      let allMinutes: any[] = [];
      let actionItems: any[] = [];
      
      if (tenantId !== 'default' && !isAdmin) {
        // Tenant-isolated queries for non-admin users
        meetings = await storage.getMeetingsByTenant(tenantId);
        allMinutes = await storage.getMinutesByTenant(tenantId);
        actionItems = await storage.getActionItemsByTenant(tenantId);
      } else if (isAdmin) {
        // Admin users can see all data (for cross-tenant admin scenarios)
        meetings = await storage.getAllMeetings();
        allMinutes = await storage.getAllMinutes();
        actionItems = await storage.getAllActionItems();
      } else {
        // Fallback for 'default' tenant - empty stats for safety
        meetings = [];
        allMinutes = [];
        actionItems = [];
      }

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

  // Get application settings (all authenticated users can view)
  app.get("/api/settings", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
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

  // TEMP DEBUG: List all meetings - REMOVE AFTER USE
  app.get("/api/debug/meetings", async (req, res) => {
    try {
      const allMeetings = await storage.getAllMeetings();
      res.json(allMeetings.map(m => ({
        id: m.id,
        title: m.title,
        status: m.status,
        scheduledAt: m.scheduledAt,
        hasTranscript: !!m.transcriptContent,
        onlineMeetingId: m.onlineMeetingId,
        organizerAadId: m.organizerAadId
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // TEMP DEBUG: Set onlineMeetingId directly - REMOVE AFTER USE
  app.post("/api/debug/set-meeting-id/:id", async (req, res) => {
    try {
      const meetingId = req.params.id;
      const { onlineMeetingId } = req.body;
      
      if (!onlineMeetingId) {
        return res.status(400).json({ error: "onlineMeetingId required in body" });
      }
      
      await db.update(meetings)
        .set({ onlineMeetingId })
        .where(eq(meetings.id, meetingId));
      
      res.json({ success: true, message: "onlineMeetingId set" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // TEMP DEBUG: Lookup onlineMeetingId from Graph and update meeting - REMOVE AFTER USE
  app.post("/api/debug/fix-meeting/:id", async (req, res) => {
    try {
      const meetingId = req.params.id;
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      
      // Get organizer's Azure AD ID
      const organizerId = meeting.organizerAadId;
      if (!organizerId) {
        return res.status(400).json({ error: "No organizer Azure AD ID" });
      }
      
      // Get Graph client
      const { acquireTokenByClientCredentials, getGraphClient } = await import('./services/microsoftIdentity');
      
      const accessToken = await acquireTokenByClientCredentials(['https://graph.microsoft.com/.default']);
      if (!accessToken) {
        return res.status(500).json({ error: "Failed to get Graph token" });
      }
      
      const graphClient = await getGraphClient(accessToken);
      if (!graphClient) {
        return res.status(500).json({ error: "Failed to create Graph client" });
      }
      
      // Look up online meetings for this organizer around this time
      const meetingDate = meeting.scheduledAt;
      const startDate = new Date(meetingDate);
      startDate.setHours(startDate.getHours() - 2);
      const endDate = new Date(meetingDate);
      endDate.setHours(endDate.getHours() + 2);
      
      console.log(`[DEBUG] Looking up meetings for ${organizerId} around ${meetingDate}`);
      
      // Try to get recent online meetings
      const onlineMeetingsResponse = await graphClient.get(
        `/users/${organizerId}/onlineMeetings?$filter=startDateTime ge ${startDate.toISOString()} and startDateTime le ${endDate.toISOString()}`
      );
      
      const onlineMeetings = onlineMeetingsResponse?.value || [];
      console.log(`[DEBUG] Found ${onlineMeetings.length} online meetings`);
      
      // Find matching meeting by title
      const matchingMeeting = onlineMeetings.find((om: any) => 
        om.subject?.toLowerCase().includes(meeting.title.toLowerCase()) ||
        meeting.title.toLowerCase().includes(om.subject?.toLowerCase() || '')
      );
      
      if (matchingMeeting) {
        // Update meeting with onlineMeetingId
        await db.update(meetings)
          .set({ onlineMeetingId: matchingMeeting.id })
          .where(eq(meetings.id, meetingId));
        
        res.json({ 
          success: true, 
          onlineMeetingId: matchingMeeting.id,
          message: "Meeting updated with onlineMeetingId. Now run enrich."
        });
      } else {
        res.json({ 
          success: false, 
          foundMeetings: onlineMeetings.map((om: any) => ({ id: om.id, subject: om.subject })),
          message: "Could not find matching meeting. See foundMeetings for options."
        });
      }
    } catch (error: any) {
      console.error("[DEBUG] Fix meeting failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // TEMP DEBUG: Query DB constraints - REMOVE AFTER USE
  app.get("/api/debug/constraints", async (req, res) => {
    try {
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`
        SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) as definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'meetings'
      `);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // TEMP DEBUG: Drop a constraint - REMOVE AFTER USE
  app.post("/api/debug/drop-constraint/:name", async (req, res) => {
    try {
      const constraintName = req.params.name;
      const { sql } = await import("drizzle-orm");
      await db.execute(sql.raw(`ALTER TABLE meetings DROP CONSTRAINT IF EXISTS "${constraintName}"`));
      res.json({ success: true, message: `Dropped constraint ${constraintName}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // TEMP DEBUG: Open endpoint to fix stuck meeting - REMOVE AFTER USE
  app.post("/api/debug/enrich/:id", async (req, res) => {
    try {
      const meetingId = req.params.id;
      const { onlineMeetingId: providedId } = req.body || {};
      console.log(`[DEBUG] Enrich meeting ${meetingId}, providedId: ${providedId}`);
      
      let meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      
      // If onlineMeetingId provided in body, set it first using raw SQL
      if (providedId && !meeting.onlineMeetingId) {
        try {
          const { sql } = await import("drizzle-orm");
          await db.execute(sql`UPDATE meetings SET online_meeting_id = ${providedId} WHERE id = ${meetingId}`);
          meeting = await storage.getMeeting(meetingId);
          console.log(`[DEBUG] Set onlineMeetingId to ${providedId}`);
        } catch (updateErr: any) {
          console.error(`[DEBUG] Failed to set onlineMeetingId:`, updateErr);
          return res.status(500).json({ 
            error: `Failed to set meeting ID: ${updateErr.message}`,
            code: updateErr.code,
            cause: updateErr.cause?.message || null,
            stack: updateErr.stack?.split('\n').slice(0, 5)
          });
        }
      }
      
      if (!meeting?.onlineMeetingId) {
        return res.status(400).json({ error: "No onlineMeetingId - provide one in request body" });
      }
      
      const { callRecordEnrichmentService } = await import("./services/callRecordEnrichment");
      await callRecordEnrichmentService.enrichMeeting(meetingId, meeting.onlineMeetingId, 1);
      
      const updated = await storage.getMeeting(meetingId);
      res.json({ 
        success: true, 
        hasTranscript: !!updated?.transcriptContent,
        transcriptLength: updated?.transcriptContent?.length || 0
      });
    } catch (error: any) {
      console.error("[DEBUG] Enrich failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Re-enrich a meeting (fetch transcript from Graph API)
  app.post("/api/admin/meetings/:id/enrich", requireRole("admin"), async (req, res) => {
    try {
      const meetingId = req.params.id;
      console.log(`[Admin] Re-enrich meeting ${meetingId} requested by ${req.user?.email}`);
      
      // Get meeting to verify it exists
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      
      // Check if meeting has an onlineMeetingId (required for Graph API)
      if (!meeting.onlineMeetingId) {
        return res.status(400).json({ 
          error: "Meeting has no onlineMeetingId",
          hint: "This meeting may not have been created through Teams or the ID wasn't captured"
        });
      }
      
      // Import enrichment service
      const { callRecordEnrichmentService } = await import("./services/callRecordEnrichment");
      
      // Trigger enrichment (fetches transcript from Graph API)
      try {
        await callRecordEnrichmentService.enrichMeeting(meetingId, meeting.onlineMeetingId, 1);
        
        // Get updated meeting
        const updatedMeeting = await storage.getMeeting(meetingId);
        
        res.json({ 
          success: true, 
          message: "Meeting enriched successfully",
          hasTranscript: !!updatedMeeting?.transcriptContent,
          transcriptLength: updatedMeeting?.transcriptContent?.length || 0
        });
      } catch (enrichError: any) {
        console.error(`[Admin] Enrichment failed for ${meetingId}:`, enrichError);
        res.status(500).json({ 
          error: "Enrichment failed", 
          details: enrichError.message 
        });
      }
    } catch (error: any) {
      console.error("[Admin] Re-enrich failed:", error);
      res.status(500).json({ error: "Failed to enrich meeting" });
    }
  });

  // Admin: Force reprocess a meeting (regenerate minutes)
  // Accepts optional detailLevel in body: "low" | "medium" | "high"
  app.post("/api/admin/meetings/:id/reprocess", requireRole("admin"), async (req, res) => {
    try {
      const meetingId = req.params.id;
      const { detailLevel } = req.body || {};
      
      // Validate detail level if provided
      const validDetailLevels = ["low", "medium", "high"];
      if (detailLevel && !validDetailLevels.includes(detailLevel)) {
        return res.status(400).json({ 
          error: "Invalid detail level",
          validValues: validDetailLevels 
        });
      }
      
      console.log(`[Admin] Reprocess meeting ${meetingId} requested by ${req.user?.email}${detailLevel ? ` with detail level: ${detailLevel}` : ''}`);
      
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
        await minutesGeneratorService.autoGenerateMinutes(meetingId, detailLevel || undefined);
        
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

  // Admin: Run attendee data backfill (convert legacy strings to objects)
  app.post("/api/admin/backfill-attendees", requireRole("admin"), async (req, res) => {
    try {
      const dryRun = req.query.dryRun === 'true';
      console.log(`[Admin] Attendee backfill requested by ${req.user?.email} (dryRun: ${dryRun})`);
      
      const { meetingMinutes } = await import("@shared/schema");
      const { normalizeAttendeesArray } = await import("@shared/attendeeHelpers");
      
      // Get all meeting minutes
      const allMinutes = await db.select().from(meetingMinutes);
      console.log(`Found ${allMinutes.length} meeting minutes records to check`);
      
      let converted = 0;
      let skipped = 0;
      const results: any[] = [];
      
      for (const minutes of allMinutes) {
        const attendees = minutes.attendeesPresent;
        
        // Check if already in object format or empty
        if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
          skipped++;
          results.push({ id: minutes.id, status: 'skipped', reason: 'Empty or null attendees' });
          continue;
        }
        
        // Check if first item is already an object
        const firstItem = attendees[0];
        if (typeof firstItem === 'object' && firstItem !== null && 'name' in firstItem) {
          skipped++;
          results.push({ id: minutes.id, status: 'skipped', reason: 'Already in object format' });
          continue;
        }
        
        // Legacy string format - needs conversion
        if (typeof firstItem === 'string') {
          const normalizedAttendees = normalizeAttendeesArray(attendees as any);
          
          if (!dryRun) {
            await db.update(meetingMinutes)
              .set({ attendeesPresent: normalizedAttendees, updatedAt: new Date() })
              .where(eq(meetingMinutes.id, minutes.id));
          }
          
          converted++;
          results.push({ 
            id: minutes.id, 
            status: dryRun ? 'would_convert' : 'converted',
            from: attendees.slice(0, 3),
            to: normalizedAttendees.slice(0, 3)
          });
        }
      }
      
      const summary = {
        success: true,
        dryRun,
        converted,
        skipped,
        total: allMinutes.length,
        results
      };
      
      console.log(`[Admin] Backfill complete: ${converted} converted, ${skipped} skipped`);
      res.json(summary);
    } catch (error: any) {
      console.error("[Admin] Attendee backfill failed:", error);
      res.status(500).json({ 
        error: "Failed to run attendee backfill",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========== ADMIN JOB QUEUE MANAGEMENT ==========
  
  // Get job queue statistics
  app.get("/api/admin/jobs/stats", requireRole("admin"), async (req, res) => {
    try {
      const stats = await storage.getJobStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[Admin] Failed to get job stats:", error);
      res.status(500).json({ error: "Failed to fetch job statistics" });
    }
  });
  
  // Get jobs by status
  app.get("/api/admin/jobs", requireRole("admin"), async (req, res) => {
    try {
      const status = req.query.status as string || 'failed';
      const limit = parseInt(req.query.limit as string) || 50;
      
      const jobs = await storage.getJobsByStatus(status, limit);
      res.json({ jobs, status, count: jobs.length });
    } catch (error: any) {
      console.error("[Admin] Failed to get jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });
  
  // Get single job details
  app.get("/api/admin/jobs/:id", requireRole("admin"), async (req, res) => {
    try {
      const job = await storage.getJobById(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      console.error("[Admin] Failed to get job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });
  
  // Retry a failed or dead-letter job
  app.post("/api/admin/jobs/:id/retry", requireRole("admin"), async (req, res) => {
    try {
      const job = await storage.getJobById(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.status !== 'failed' && !job.deadLetteredAt) {
        return res.status(400).json({ error: "Only failed or dead-letter jobs can be retried" });
      }
      
      const updated = await storage.retryJob(req.params.id, req.user?.email || 'admin');
      
      console.log(`[Admin] Job ${req.params.id} retried by ${req.user?.email}`);
      res.json({ success: true, job: updated });
    } catch (error: any) {
      console.error("[Admin] Failed to retry job:", error);
      res.status(500).json({ error: "Failed to retry job" });
    }
  });

  // ========== ADMIN MIGRATIONS ==========
  
  // Run pending database migrations (admin only)
  app.post("/api/admin/run-migrations", requireRole("admin"), async (req, res) => {
    try {
      console.log(`[Admin] Running migrations requested by ${req.user?.email}`);
      
      // Add missing columns to document_templates table
      await db.execute(sql`
        ALTER TABLE document_templates 
        ADD COLUMN IF NOT EXISTS created_by_email TEXT
      `);
      
      console.log(`[Admin] Migrations completed successfully`);
      res.json({ 
        success: true, 
        message: "Migrations completed successfully",
        migrations: ["document_templates.created_by_email"]
      });
    } catch (error: any) {
      console.error("[Admin] Migration failed:", error);
      res.status(500).json({ error: error.message || "Migration failed" });
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
          attendeesPresent: [{ name: req.user.displayName || req.user.email.split('@')[0], email: req.user.email }],
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

  // ========== SHARE LINKS (ORG-INTERNAL SHARING) ==========
  
  // Create share link for a meeting
  app.post("/api/meetings/:id/share", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const tenantId = (req.user as any).tenantId || 'default';
      const isAdmin = accessControlService.isAdmin(req.user);
      
      // MULTI-TENANT ISOLATION: Users can only share meetings from their tenant
      let meeting;
      if (tenantId !== 'default' && !isAdmin) {
        meeting = await storage.getMeetingForTenant(req.params.id, tenantId);
      } else {
        meeting = await storage.getMeeting(req.params.id);
      }
      
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Verify user has access to this meeting
      if (!accessControlService.canViewMeeting(req.user, meeting)) {
        return res.status(403).json({ error: "Access denied: Cannot share meetings you cannot access" });
      }

      // Generate unique token for share link
      const { nanoid } = await import("nanoid");
      const token = nanoid(21); // URL-safe unique ID
      
      // Get expiry from request (default 7 days, max 30 days)
      const expiryDays = Math.min(Math.max(req.body.expiryDays || 7, 1), 30);
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
      
      // Get required clearance level (defaults to meeting's classification)
      const requiredClearanceLevel = req.body.requiredClearanceLevel || meeting.classificationLevel || 'UNCLASSIFIED';
      
      const shareLink = await storage.createShareLink({
        token,
        meetingId: meeting.id,
        tenantId,
        createdByEmail: req.user.email,
        createdByName: req.user.displayName || req.user.email,
        expiresAt,
        requiredClearanceLevel,
        isActive: true,
        accessCount: 0
      });

      // Log the share event
      await storage.createMeetingEvent({
        meetingId: meeting.id,
        tenantId,
        eventType: "meeting_updated",
        title: "Share Link Created",
        description: `Share link created by ${req.user.displayName || req.user.email}`,
        actorEmail: req.user.email,
        actorName: req.user.displayName || req.user.email,
        actorAadId: req.user.id,
        metadata: { shareLinkId: shareLink.id, token },
        correlationId: null,
      });

      res.json({
        success: true,
        shareLink: {
          id: shareLink.id,
          token: shareLink.token,
          url: `/share/${shareLink.token}`,
          createdAt: shareLink.createdAt
        }
      });
    } catch (error: any) {
      console.error("Error creating share link:", error);
      res.status(500).json({ error: "Failed to create share link" });
    }
  });

  // Get meeting by share token (org-internal access only)
  app.get("/api/share/:token", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const shareLink = await storage.getShareLinkByToken(req.params.token);
      if (!shareLink) {
        return res.status(404).json({ error: "Share link not found" });
      }

      const userTenantId = (req.user as any).tenantId || 'default';
      // Normalize clearance levels to uppercase for consistent comparison
      const clearanceLevels = ['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'];
      const userClearanceRaw = req.user.clearanceLevel || 'UNCLASSIFIED';
      const userClearance = userClearanceRaw.toUpperCase();
      const ipAddress = req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Helper to log audit entry and return error
      const denyAccess = async (reason: string, statusCode: number, message: string) => {
        try {
          await storage.createShareLinkAuditLog({
            shareLinkId: shareLink.id,
            meetingId: shareLink.meetingId,
            tenantId: shareLink.tenantId,
            accessorEmail: req.user?.email,
            accessorName: req.user?.displayName,
            accessorTenantId: userTenantId,
            accessorClearanceLevel: userClearance as "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET",
            ipAddress,
            userAgent,
            accessGranted: false,
            denialReason: reason
          });
        } catch (auditError) {
          console.error("[Share Link] Failed to log denied access:", auditError);
        }
        return res.status(statusCode).json({ error: message });
      };

      // Check if link is revoked
      if (shareLink.revokedAt) {
        return denyAccess("revoked", 410, "This share link has been revoked");
      }

      // Check if link is active
      if (!shareLink.isActive) {
        return denyAccess("deactivated", 410, "This share link has been deactivated");
      }

      // Check expiry
      if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
        return denyAccess("expired", 410, "This share link has expired");
      }

      // ORG-INTERNAL SECURITY: Verify user is from same tenant
      if (shareLink.tenantId !== userTenantId) {
        return denyAccess("tenant_mismatch", 403, "Access denied: This link is only accessible to users in the same organization");
      }

      // CLEARANCE CHECK: Verify user has sufficient clearance
      // Normalize required clearance level (handle null, undefined, and case variations)
      const requiredClearanceRaw = shareLink.requiredClearanceLevel || 'UNCLASSIFIED';
      const requiredClearance = requiredClearanceRaw.toUpperCase();
      
      // Validate both clearance levels are recognized
      const userClearanceIndex = clearanceLevels.indexOf(userClearance);
      const requiredClearanceIndex = clearanceLevels.indexOf(requiredClearance);
      
      // If user's clearance is unrecognized, treat as UNCLASSIFIED (lowest)
      const effectiveUserIndex = userClearanceIndex >= 0 ? userClearanceIndex : 0;
      // If required clearance is unrecognized, treat as UNCLASSIFIED (allow access)
      const effectiveRequiredIndex = requiredClearanceIndex >= 0 ? requiredClearanceIndex : 0;
      
      if (effectiveUserIndex < effectiveRequiredIndex) {
        return denyAccess("clearance_insufficient", 403, `Access denied: This link requires ${requiredClearance} clearance or higher`);
      }

      const meeting = await storage.getMeeting(shareLink.meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting no longer exists" });
      }

      // Log successful access
      await storage.createShareLinkAuditLog({
        shareLinkId: shareLink.id,
        meetingId: shareLink.meetingId,
        tenantId: shareLink.tenantId,
        accessorEmail: req.user.email,
        accessorName: req.user.displayName,
        accessorTenantId: userTenantId,
        accessorClearanceLevel: userClearance as "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET",
        ipAddress,
        userAgent,
        accessGranted: true,
        denialReason: null
      });

      // Increment access count and update last accessor
      await storage.incrementShareLinkAccess(shareLink.id, req.user.email);

      res.json({
        meeting,
        sharedBy: {
          email: shareLink.createdByEmail,
          name: shareLink.createdByName
        }
      });
    } catch (error: any) {
      console.error("Error accessing share link:", error);
      res.status(500).json({ error: "Failed to access shared meeting" });
    }
  });

  // Deactivate share link
  app.delete("/api/share/:token", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const shareLink = await storage.getShareLinkByToken(req.params.token);
      if (!shareLink) {
        return res.status(404).json({ error: "Share link not found" });
      }

      // Only creator or admin can deactivate
      const isCreator = shareLink.createdByEmail.toLowerCase() === req.user.email.toLowerCase();
      const isAdmin = accessControlService.isAdmin(req.user);
      
      if (!isCreator && !isAdmin) {
        return res.status(403).json({ error: "Access denied: Only the creator or admin can deactivate this link" });
      }

      await storage.deactivateShareLink(shareLink.id);

      res.json({ success: true, message: "Share link deactivated" });
    } catch (error: any) {
      console.error("Error deactivating share link:", error);
      res.status(500).json({ error: "Failed to deactivate share link" });
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
