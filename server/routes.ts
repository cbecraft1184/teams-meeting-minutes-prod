import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMeetingSchema, insertMeetingMinutesSchema, insertActionItemSchema } from "@shared/schema";
import { generateMeetingMinutes, extractActionItems } from "./services/azureOpenAI";
import { requireAuth } from "./middleware/auth";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  
  // Health check - public endpoint (no auth required)
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  });

  // Apply authentication middleware to all /api/* routes
  // In development, this allows all requests
  // In production, this MUST verify Azure AD JWT tokens
  app.use("/api/*", requireAuth);

  // ========== MEETINGS API ==========
  
  // Get all meetings (protected)
  app.get("/api/meetings", async (_req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      res.json(meetings);
    } catch (error: any) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  // Get single meeting
  app.get("/api/meetings/:id", async (req, res) => {
    try {
      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error: any) {
      console.error("Error fetching meeting:", error);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  // Create new meeting
  app.post("/api/meetings", async (req, res) => {
    try {
      const validatedData = insertMeetingSchema.parse(req.body);
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

  // Update meeting
  app.patch("/api/meetings/:id", async (req, res) => {
    try {
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

  // Delete meeting
  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      await storage.deleteMeeting(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // ========== MEETING MINUTES API ==========

  // Get all minutes
  app.get("/api/minutes", async (_req, res) => {
    try {
      const minutes = await storage.getAllMinutes();
      res.json(minutes);
    } catch (error: any) {
      console.error("Error fetching minutes:", error);
      res.status(500).json({ error: "Failed to fetch minutes" });
    }
  });

  // Get single minutes
  app.get("/api/minutes/:id", async (req, res) => {
    try {
      const minutes = await storage.getMinutes(req.params.id);
      if (!minutes) {
        return res.status(404).json({ error: "Minutes not found" });
      }
      res.json(minutes);
    } catch (error: any) {
      console.error("Error fetching minutes:", error);
      res.status(500).json({ error: "Failed to fetch minutes" });
    }
  });

  // Generate minutes for a meeting
  app.post("/api/minutes/generate", async (req, res) => {
    try {
      const { meetingId, transcript } = req.body;
      
      if (!meetingId || !transcript) {
        return res.status(400).json({ error: "Meeting ID and transcript are required" });
      }

      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

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

  // Update minutes
  app.patch("/api/minutes/:id", async (req, res) => {
    try {
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
