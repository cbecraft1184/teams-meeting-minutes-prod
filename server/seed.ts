// Seed database with sample DOD meeting data
import { db } from "./db";
import { meetings, meetingMinutes, actionItems } from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database with sample DOD meeting data...");

  try {
    // Check if data already exists
    const existing = await db.select().from(meetings).limit(1);
    if (existing.length > 0) {
      console.log("✓ Database already seeded, skipping...");
      return;
    }

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
