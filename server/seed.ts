// Seed database with sample meeting data
import { db } from "./db";
import { meetings, meetingMinutes, actionItems, meetingTemplates } from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database with sample meeting data...");

  try {
    // Check if data already exists
    const existing = await db.select().from(meetings).limit(1);
    if (existing.length > 0) {
      console.log("✓ Database already seeded, skipping...");
      return;
    }

    // Seed system meeting templates first
    console.log("📋 Creating system meeting templates...");
    await db.insert(meetingTemplates).values([
      {
        name: "Command Briefing",
        description: "Standard briefing for command leadership on operational status",
        type: "briefing",
        defaultDuration: "1h",
        defaultClassification: "CONFIDENTIAL",
        suggestedAttendees: ["leadership@contoso.com", "executive@contoso.com", "operations@contoso.com"],
        agendaItems: [
          "Operational Status Update",
          "Personnel Readiness",
          "Resource Allocation",
          "Mission Planning",
          "Questions and Discussion"
        ],
        isSystem: true
      },
      {
        name: "Status Review Meeting",
        description: "Weekly status review of ongoing projects and initiatives",
        type: "status_review",
        defaultDuration: "1h 30m",
        defaultClassification: "UNCLASSIFIED",
        suggestedAttendees: ["project.manager@contoso.com", "team.lead@contoso.com"],
        agendaItems: [
          "Review Previous Action Items",
          "Project Status Updates",
          "Risk Assessment",
          "Resource Requirements",
          "Next Steps and Assignments"
        ],
        isSystem: true
      },
      {
        name: "Quarterly Planning Session",
        description: "Strategic planning session for quarterly objectives",
        type: "planning",
        defaultDuration: "2h",
        defaultClassification: "UNCLASSIFIED",
        suggestedAttendees: ["division.chief@contoso.com", "department.head@contoso.com", "budget.officer@contoso.com"],
        agendaItems: [
          "Review Previous Quarter Performance",
          "Strategic Objectives Discussion",
          "Budget and Resource Planning",
          "Timeline and Milestones",
          "Risk Mitigation Strategies",
          "Action Item Assignment"
        ],
        isSystem: true
      },
      {
        name: "Emergency Response Coordination",
        description: "Coordination meeting for emergency response procedures",
        type: "emergency_response",
        defaultDuration: "1h",
        defaultClassification: "SECRET",
        suggestedAttendees: ["emergency.coordinator@contoso.com", "operations.manager@contoso.com", "security.officer@contoso.com"],
        agendaItems: [
          "Situation Assessment",
          "Response Team Coordination",
          "Resource Deployment",
          "Communication Protocols",
          "Immediate Action Items"
        ],
        isSystem: true
      },
      {
        name: "Security Review Board",
        description: "Monthly security posture and compliance review",
        type: "briefing",
        defaultDuration: "1h 30m",
        defaultClassification: "CONFIDENTIAL",
        suggestedAttendees: ["security.officer@dod.gov", "compliance.officer@dod.gov", "it.security@dod.gov"],
        agendaItems: [
          "Security Incident Review",
          "Compliance Status Update",
          "Vulnerability Assessment Results",
          "Policy Updates and Changes",
          "Remediation Action Items"
        ],
        isSystem: true
      }
    ]);
    console.log("✓ Created 5 system templates");

    // Sample meeting 1
    const [meeting1] = await db.insert(meetings).values({
      title: "Weekly Status Review",
      description: "Review project progress and discuss any blockers",
      scheduledAt: new Date("2025-10-25T14:00:00Z"),
      duration: "1h 30m",
      attendees: ["john.doe@dod.gov", "jane.smith@dod.gov", "bob.johnson@dod.gov"],
      status: "completed",
      classificationLevel: "UNCLASSIFIED",
      recordingUrl: null,
      transcriptUrl: null,
    }).returning();

    // Sample minutes for meeting 1
    const [minutes1] = await db.insert(meetingMinutes).values({
      meetingId: meeting1.id,
      summary: "Team discussed quarterly objectives and reviewed current sprint progress. All milestones are on track for Q4 delivery.",
      keyDiscussions: [
        "Q4 budget allocation and resource planning",
        "Timeline review for upcoming deliverables",
        "Risk assessment for critical path items"
      ],
      decisions: [
        "Approved additional team member hire",
        "Extended deadline for security review by 1 week",
        "Increased travel budget for stakeholder meetings"
      ],
      attendeesPresent: ["john.doe@dod.gov", "jane.smith@dod.gov", "bob.johnson@dod.gov"],
      processingStatus: "completed",
      sharepointUrl: null,
      docxUrl: null,
      pdfUrl: null,
    }).returning();

    // Sample action items
    await db.insert(actionItems).values([
      {
        meetingId: meeting1.id,
        minutesId: minutes1.id,
        task: "Prepare Q4 budget proposal with updated resource requirements",
        assignee: "john.doe@dod.gov",
        dueDate: new Date("2025-11-05T00:00:00Z"),
        priority: "high",
        status: "in_progress",
      },
      {
        meetingId: meeting1.id,
        minutesId: minutes1.id,
        task: "Schedule security review meeting with compliance team",
        assignee: "jane.smith@dod.gov",
        dueDate: new Date("2025-11-01T00:00:00Z"),
        priority: "high",
        status: "pending",
      }
    ]);

    // Sample meeting 2
    const [meeting2] = await db.insert(meetings).values({
      title: "Security Architecture Review",
      description: "Quarterly security posture assessment and compliance check",
      scheduledAt: new Date("2025-10-28T10:00:00Z"),
      duration: "2h",
      attendees: ["security.officer@dod.gov", "architect@dod.gov", "compliance@dod.gov"],
      status: "completed",
      classificationLevel: "CONFIDENTIAL",
      recordingUrl: null,
      transcriptUrl: null,
    }).returning();

    // Sample meeting 3 (pending minutes)
    const [meeting3] = await db.insert(meetings).values({
      title: "Emergency Response Planning",
      description: "Discuss and update emergency response procedures",
      scheduledAt: new Date("2025-10-30T09:00:00Z"),
      duration: "1h",
      attendees: ["emergency.coord@dod.gov", "ops.manager@dod.gov"],
      status: "in_progress",
      classificationLevel: "SECRET",
      recordingUrl: null,
      transcriptUrl: null,
    }).returning();

    // Add pending minutes
    await db.insert(meetingMinutes).values({
      meetingId: meeting3.id,
      summary: "",
      keyDiscussions: [],
      decisions: [],
      attendeesPresent: [],
      processingStatus: "pending",
      sharepointUrl: null,
      docxUrl: null,
      pdfUrl: null,
    });

    console.log("✓ Database seeded successfully!");
    console.log(`  - ${5} meeting templates created`);
    console.log(`  - ${3} meetings created`);
    console.log(`  - ${3} minutes records created`);
    console.log(`  - ${2} action items created`);
  } catch (error) {
    console.error("✗ Error seeding database:", error);
    throw error;
  }
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seed };
