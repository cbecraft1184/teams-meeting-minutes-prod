import { db } from './db';
import { meetings, meetingMinutes, actionItems, users } from '../shared/schema';

async function seedDemoData() {
  console.log('🌱 Seeding demo data...');

  // Create demo users matching mockUsers.json for proper Azure AD group simulation
  const demoUsers = [
    {
      email: 'admin@contoso.test',
      displayName: 'Admin User',
      azureAdId: '00000000-0000-0000-0000-00000000admin',  // Contains 'admin' for mock groups
      clearanceLevel: 'TOP_SECRET' as const,
      role: 'admin' as const,
      department: 'IT Operations',
      organizationalUnit: 'Technology Division',
    },
    {
      email: 'approver@contoso.test',
      displayName: 'Approver User',
      azureAdId: '00000000-0000-0000-0000-000approver001',  // Contains 'approver' for mock groups
      clearanceLevel: 'SECRET' as const,
      role: 'approver' as const,
      department: 'Operations',
      organizationalUnit: 'Command Center',
    },
    {
      email: 'auditor@contoso.test',
      displayName: 'Auditor User',
      azureAdId: '00000000-0000-0000-0000-000auditor0001',  // Contains 'auditor' for mock groups
      clearanceLevel: 'TOP_SECRET' as const,
      role: 'auditor' as const,
      department: 'Compliance',
      organizationalUnit: 'Security Division',
    },
    {
      email: 'john.doe@contoso.com',
      displayName: 'John Doe',
      azureAdId: '00000000-0000-0000-0000-000000000004',
      clearanceLevel: 'CONFIDENTIAL' as const,
      role: 'viewer' as const,
      department: 'Logistics',
      organizationalUnit: 'Supply Chain',
    },
  ];

  for (const user of demoUsers) {
    await db.insert(users).values(user).onConflictDoUpdate({
      target: users.email,
      set: user,
    });
  }

  console.log('✅ Created demo users');

  // Create demo meetings
  const now = new Date();
  const demoMeetings = [
    {
      title: 'Q4 Strategic Planning Session',
      description: 'Quarterly strategic planning and goal setting for Q4 2025',
      scheduledAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      duration: '2 hours',
      attendees: ['admin@contoso.test', 'approver@contoso.test', 'auditor@contoso.test', 'john.doe@contoso.com'],
      organizerAadId: '00000000-0000-0000-0000-00000000admin',
      status: 'completed' as const,
      classificationLevel: 'CONFIDENTIAL' as const,
      teamsJoinLink: 'https://teams.microsoft.com/l/meetup-join/...',
      recordingUrl: 'https://example.com/recording1.mp4',
      transcriptUrl: 'https://example.com/transcript1.vtt',
      graphSyncStatus: 'enriched' as const,
      enrichmentStatus: 'enriched' as const,
    },
    {
      title: 'Product Roadmap Review',
      description: 'Review and prioritize product features for next release',
      scheduledAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      duration: '1 hour 30 min',
      attendees: ['john.doe@contoso.com', 'approver@contoso.test', 'auditor@contoso.test', 'admin@contoso.test'],
      organizerAadId: '00000000-0000-0000-0000-000approver001',
      status: 'completed' as const,
      classificationLevel: 'UNCLASSIFIED' as const,
      teamsJoinLink: 'https://teams.microsoft.com/l/meetup-join/...',
      recordingUrl: 'https://example.com/recording2.mp4',
      transcriptUrl: 'https://example.com/transcript2.vtt',
      graphSyncStatus: 'enriched' as const,
      enrichmentStatus: 'enriched' as const,
    },
    {
      title: 'Security Incident Response Planning',
      description: 'Develop response procedures for potential security incidents',
      scheduledAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      duration: '1 hour',
      attendees: ['john.doe@contoso.com', 'admin@contoso.test'],
      organizerAadId: '00000000-0000-0000-0000-000000000001',
      status: 'completed' as const,
      classificationLevel: 'SECRET' as const,
      teamsJoinLink: 'https://teams.microsoft.com/l/meetup-join/...',
      recordingUrl: 'https://example.com/recording3.mp4',
      transcriptUrl: 'https://example.com/transcript3.vtt',
      graphSyncStatus: 'enriched' as const,
      enrichmentStatus: 'enriched' as const,
    },
    {
      title: 'Weekly Team Standup',
      description: 'Weekly progress updates and blocker discussion',
      scheduledAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      duration: '30 minutes',
      attendees: ['john.doe@contoso.com', 'auditor@contoso.test', 'approver@contoso.test', 'admin@contoso.test'],
      organizerAadId: '00000000-0000-0000-0000-000auditor0001',
      status: 'completed' as const,
      classificationLevel: 'UNCLASSIFIED' as const,
      teamsJoinLink: 'https://teams.microsoft.com/l/meetup-join/...',
      recordingUrl: 'https://example.com/recording4.mp4',
      transcriptUrl: 'https://example.com/transcript4.vtt',
      graphSyncStatus: 'enriched' as const,
      enrichmentStatus: 'enriched' as const,
    },
    {
      title: 'Customer Feedback Analysis',
      description: 'Review recent customer feedback and prioritize improvements',
      scheduledAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      duration: '1 hour',
      attendees: ['john.doe@contoso.com', 'approver@contoso.test', 'auditor@contoso.test'],
      organizerAadId: '00000000-0000-0000-0000-000approver001',
      status: 'in_progress' as const,
      classificationLevel: 'UNCLASSIFIED' as const,
      teamsJoinLink: 'https://teams.microsoft.com/l/meetup-join/...',
      recordingUrl: 'https://example.com/recording5.mp4',
      transcriptUrl: 'https://example.com/transcript5.vtt',
      graphSyncStatus: 'enriched' as const,
      enrichmentStatus: 'enriching' as const,
    },
    {
      title: 'Infrastructure Migration Planning',
      description: 'Plan migration to new cloud infrastructure',
      scheduledAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      duration: '2 hours',
      attendees: ['john.doe@contoso.com', 'auditor@contoso.test', 'admin@contoso.test'],
      organizerAadId: '00000000-0000-0000-0000-000000000001',
      status: 'scheduled' as const,
      classificationLevel: 'CONFIDENTIAL' as const,
      teamsJoinLink: 'https://teams.microsoft.com/l/meetup-join/...',
    },
  ];

  const insertedMeetings = [];
  for (const meeting of demoMeetings) {
    const [inserted] = await db.insert(meetings).values(meeting).returning();
    insertedMeetings.push(inserted);
  }

  console.log(`✅ Created ${insertedMeetings.length} demo meetings`);

  // Create meeting minutes for completed meetings
  const minutesData = [
    {
      meetingId: insertedMeetings[0].id,
      summary: 'Q4 strategic planning session covering revenue targets, product launch timeline, team expansion, and key strategic decisions. Approved $500K marketing budget and confirmed November 15 launch date.',
      keyDiscussions: [
        'Q4 Revenue Targets - Set aggressive but achievable goals at $15M for the quarter, representing 25% growth over Q3',
        'Product Launch Timeline - Confirmed development on track with beta testing to begin in 2 weeks',
        'Hiring and Team Expansion - Approved headcount increase for engineering and sales teams',
        'Partnership Strategy - Discussed strategic partnership opportunities with Enterprise Corp',
      ],
      decisions: [
        'Approved additional $500K budget for Q4 marketing campaign',
        'Confirmed November 15, 2025 as official product launch date',
        'Created new VP of Engineering role to support growth',
        'Approved pursuit of strategic partnership with Enterprise Corp',
      ],
      attendeesPresent: ['john.doe@contoso.com', 'approver@contoso.test', 'auditor@contoso.test', 'admin@contoso.test'],
      processingStatus: 'completed' as const,
      approvalStatus: 'approved' as const,
      approvedBy: 'john.doe@contoso.com',
      approvedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      sharepointUrl: 'https://company.sharepoint.com/sites/meetings/2025/11/q4-strategic-planning.docx',
      docxUrl: 'https://company.sharepoint.com/sites/meetings/2025/11/q4-strategic-planning.docx',
    },
    {
      meetingId: insertedMeetings[1].id,
      summary: 'Product roadmap review prioritizing features for next release. High-priority items include analytics dashboard, mobile improvements, and API enhancements. December 15 release date confirmed.',
      keyDiscussions: [
        'Advanced Analytics Dashboard - Identified as top customer request with high impact potential',
        'Mobile App Improvements - Focus on performance optimization and UX enhancements',
        'API Rate Limit Increase - Critical requirement for enterprise customers',
        'Q1 2026 Planning - Discussed medium-priority features including dark mode and bulk import',
      ],
      decisions: [
        'Next major release scheduled for December 15, 2025',
        'Assign 60% of engineering capacity to high-priority features',
        'Launch beta program with 10 enterprise customers',
        'Update product documentation for all new features',
      ],
      attendeesPresent: ['approver@contoso.test', 'auditor@contoso.test', 'admin@contoso.test'],
      processingStatus: 'completed' as const,
      approvalStatus: 'approved' as const,
      approvedBy: 'approver@contoso.test',
      approvedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      sharepointUrl: 'https://company.sharepoint.com/sites/meetings/2025/11/product-roadmap-review.docx',
      docxUrl: 'https://company.sharepoint.com/sites/meetings/2025/11/product-roadmap-review.docx',
    },
    {
      meetingId: insertedMeetings[2].id,
      summary: 'Security incident response planning session. Approved $200K for infrastructure improvements, 2 new security engineer positions, and mandatory training. Penetration testing scheduled for January 2026.',
      keyDiscussions: [
        'Current Security Posture - Reviewed existing controls and identified gaps in response time',
        'Incident Response Team - Proposed 24/7 dedicated team with clear roles and on-call rotation',
        'Detection and Monitoring - Plans for enhanced logging and automated threat detection',
        'Communication Protocols - Established internal escalation and customer notification procedures',
      ],
      decisions: [
        'Allocate $200K for security infrastructure improvements',
        'Approve 2 security engineer positions for immediate hiring',
        'Mandatory security training for all engineering staff',
        'Schedule third-party security audit and penetration testing for January 2026',
      ],
      attendeesPresent: ['john.doe@contoso.com', 'admin@contoso.test'],
      processingStatus: 'completed' as const,
      approvalStatus: 'approved' as const,
      approvedBy: 'john.doe@contoso.com',
      approvedAt: new Date(now.getTime() - 2.5 * 24 * 60 * 60 * 1000),
      sharepointUrl: 'https://company.sharepoint.com/sites/meetings/2025/11/security-incident-planning.docx',
      docxUrl: 'https://company.sharepoint.com/sites/meetings/2025/11/security-incident-planning.docx',
    },
    {
      meetingId: insertedMeetings[3].id,
      summary: 'Weekly team standup with progress updates from all team members. Key blockers include database migration approval and staging environment issues. Overall progress on track.',
      keyDiscussions: [
        'Bob Johnson - Completed authentication module refactoring, started API performance optimization',
        'Jane Smith - Finished Q4 product roadmap documentation, conducted customer interviews',
        'Alice Williams - Deployed monitoring dashboard updates, fixed 8 critical bugs',
      ],
      decisions: [
        'Escalate database migration approval to unblock Bob',
        'Request design review resources for upcoming features',
        'Investigate and fix staging environment intermittent issues',
      ],
      attendeesPresent: ['auditor@contoso.test', 'approver@contoso.test', 'admin@contoso.test'],
      processingStatus: 'completed' as const,
      approvalStatus: 'pending_review' as const,
    },
  ];

  const insertedMinutes = [];
  for (const minute of minutesData) {
    const [inserted] = await db.insert(meetingMinutes).values(minute).returning();
    insertedMinutes.push(inserted);
  }

  console.log(`✅ Created ${minutesData.length} meeting minutes`);

  // Create action items (must reference minutesId)
  const actionItemsData = [
    // Q4 Strategic Planning actions
    {
      meetingId: insertedMeetings[0].id,
      minutesId: insertedMinutes[0].id,
      task: 'Finalize Q4 marketing budget allocation across channels and create detailed spending plan',
      assignee: 'approver@contoso.test',
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: 'in_progress' as const,
      priority: 'high' as const,
    },
    {
      meetingId: insertedMeetings[0].id,
      minutesId: insertedMinutes[0].id,
      task: 'Post VP of Engineering job requisition and create job description with HR',
      assignee: 'john.doe@contoso.com',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: 'completed' as const,
      priority: 'high' as const,
    },
    {
      meetingId: insertedMeetings[0].id,
      minutesId: insertedMinutes[0].id,
      task: 'Draft partnership proposal for Enterprise Corp outlining benefits and terms',
      assignee: 'auditor@contoso.test',
      dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      status: 'pending' as const,
      priority: 'medium' as const,
    },
    // Product Roadmap actions
    {
      meetingId: insertedMeetings[1].id,
      minutesId: insertedMinutes[1].id,
      task: 'Design analytics dashboard wireframes for advanced analytics feature',
      assignee: 'admin@contoso.test',
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      status: 'in_progress' as const,
      priority: 'high' as const,
    },
    {
      meetingId: insertedMeetings[1].id,
      minutesId: insertedMinutes[1].id,
      task: 'Recruit 10 enterprise customers for beta testing program',
      assignee: 'approver@contoso.test',
      dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      status: 'pending' as const,
      priority: 'high' as const,
    },
    {
      meetingId: insertedMeetings[1].id,
      minutesId: insertedMinutes[1].id,
      task: 'Update product documentation to reflect new features and API changes',
      assignee: 'auditor@contoso.test',
      dueDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      status: 'pending' as const,
      priority: 'medium' as const,
    },
    // Security actions
    {
      meetingId: insertedMeetings[2].id,
      minutesId: insertedMinutes[2].id,
      task: 'Schedule and coordinate interviews for 2 security engineer positions',
      assignee: 'admin@contoso.test',
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: 'in_progress' as const,
      priority: 'high' as const,
    },
    {
      meetingId: insertedMeetings[2].id,
      minutesId: insertedMinutes[2].id,
      task: 'Deploy enhanced monitoring infrastructure with improved logging and threat detection',
      assignee: 'john.doe@contoso.com',
      dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: 'pending' as const,
      priority: 'high' as const,
    },
    // Standup actions
    {
      meetingId: insertedMeetings[3].id,
      minutesId: insertedMinutes[3].id,
      task: 'Follow up with DBA team to expedite database migration approval',
      assignee: 'auditor@contoso.test',
      dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      status: 'pending' as const,
      priority: 'high' as const,
    },
    {
      meetingId: insertedMeetings[3].id,
      minutesId: insertedMinutes[3].id,
      task: 'Debug and fix intermittent issues in staging environment',
      assignee: 'admin@contoso.test',
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      status: 'in_progress' as const,
      priority: 'high' as const,
    },
  ];

  for (const item of actionItemsData) {
    await db.insert(actionItems).values(item);
  }

  console.log(`✅ Created ${actionItemsData.length} action items`);

  console.log('🎉 Demo data seeding complete!');
  console.log(`
📊 Summary:
   - Users: ${demoUsers.length}
   - Meetings: ${insertedMeetings.length}
   - Minutes: ${minutesData.length}
   - Action Items: ${actionItemsData.length}
  `);
}

// Run seed
seedDemoData()
  .then(() => {
    console.log('✅ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });

export { seedDemoData };
