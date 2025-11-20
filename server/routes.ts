import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMeetingSchema, insertMeetingMinutesSchema, insertActionItemSchema, insertMeetingTemplateSchema } from "@shared/schema";
import { generateMeetingMinutes, extractActionItems } from "./services/azureOpenAI";
import { authenticateUser, requireAuth, requireRole } from "./middleware/authenticateUser";
import { requireWebhookAuth } from "./middleware/requireServiceAuth";
import { documentExportService } from "./services/documentExport";
import { emailDistributionService } from "./services/emailDistribution";
import { accessControlService } from "./services/accessControl";
import { registerWebhookRoutes, registerAdminWebhookRoutes } from "./routes/webhooks";
import { uploadToSharePoint } from "./services/sharepointClient";
import { enqueueMeetingEnrichment } from "./services/callRecordEnrichment";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  
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

  // ========== AUTHENTICATED ENDPOINTS (REQUIRE USER AUTH) ==========
  
  // Apply authentication middleware to ALL /api/* routes
  // In mock mode: Uses config/mockUsers.json
  // In production: Validates Azure AD JWT tokens
  app.use("/api/*", authenticateUser);
  
  // Register admin webhook subscription management endpoints
  // These are AUTHENTICATED endpoints at /api/admin/webhooks/*
  // Only authenticated admins can create/delete webhook subscriptions
  registerAdminWebhookRoutes(app);

  // ========== MEETINGS API ==========
  
  // Get all meetings (filtered by user access)
  app.get("/api/meetings", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const allMeetings = await storage.getAllMeetings();
      
      // Filter meetings based on user's access level (Azure AD groups or database fallback)
      const accessibleMeetings = accessControlService.filterMeetings(req.user, allMeetings);
      
      // Log access with Azure AD group status
      const permissions = accessControlService.getUserPermissions(req.user);
      const authSource = permissions.azureAdGroupsActive ? "Azure AD groups" : "database fallback";
      
      console.log(`[ACCESS] User ${req.user.email} (${permissions.role}/${permissions.clearanceLevel}) viewing ${accessibleMeetings.length}/${allMeetings.length} meetings [${authSource}]`);
      
      res.json(accessibleMeetings);
    } catch (error: any) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
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

      const meeting = await storage.updateMeeting(req.params.id, req.body);
      res.json(meeting);
    } catch (error: any) {
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

      const minutes = await storage.updateMinutes(req.params.id, req.body);
      res.json(minutes);
    } catch (error: any) {
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

      res.json(updatedMinutes);
    } catch (error: any) {
      if (error.message === "Minutes not found") {
        return res.status(404).json({ error: "Minutes not found" });
      }
      console.error("Error rejecting minutes:", error);
      res.status(500).json({ error: "Failed to reject minutes" });
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

      const buffer = await documentExportService.generateDOCX(meeting);
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

      const buffer = await documentExportService.generatePDF(meeting);
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
      const item = await storage.updateActionItem(req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
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

  // ========== DEMO/TESTING ENDPOINTS (Mock Mode) ==========

  // Trigger mock webhook workflow (simulate Teams meeting completion)
  app.post("/api/demo/trigger-webhook/:meetingId", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const useMockServices = process.env.USE_MOCK_SERVICES !== "false";
      if (!useMockServices) {
        return res.status(400).json({ 
          error: "Demo endpoint only available in mock mode",
          hint: "Set USE_MOCK_SERVICES=true or leave undefined for development" 
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
