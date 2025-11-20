import { Meeting, MeetingMinutes, ActionItem } from '@shared/schema';

export function createMeetingSummaryCard(
  meeting: Meeting,
  minutes: MeetingMinutes,
  actionItems: ActionItem[]
): any {
  return {
    type: "AdaptiveCard",
    version: "1.4",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    body: [
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: "📋 Meeting Summary",
            weight: "Bolder",
            size: "Large",
            color: "Accent"
          },
          {
            type: "TextBlock",
            text: meeting.title,
            weight: "Bolder",
            size: "Medium",
            wrap: true
          }
        ]
      },
      {
        type: "FactSet",
        facts: [
          {
            title: "Date:",
            value: new Date(meeting.scheduledAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short'
            })
          },
          {
            title: "Duration:",
            value: meeting.duration
          },
          {
            title: "Attendees:",
            value: minutes.attendeesPresent.join(', ')
          },
          {
            title: "Classification:",
            value: meeting.classificationLevel
          }
        ]
      },
      {
        type: "TextBlock",
        text: "**Summary**",
        weight: "Bolder",
        spacing: "Medium"
      },
      {
        type: "TextBlock",
        text: minutes.summary,
        wrap: true,
        spacing: "Small"
      },
      ...(minutes.decisions && minutes.decisions.length > 0 ? [
        {
          type: "TextBlock",
          text: "**Key Decisions**",
          weight: "Bolder",
          spacing: "Medium"
        },
        ...minutes.decisions.map((decision: string) => ({
          type: "TextBlock",
          text: `• ${decision}`,
          wrap: true,
          spacing: "Small"
        }))
      ] : []),
      ...(actionItems && actionItems.length > 0 ? [
        {
          type: "TextBlock",
          text: "**Action Items**",
          weight: "Bolder",
          spacing: "Medium",
          color: "Attention"
        },
        ...actionItems.slice(0, 5).map((item: ActionItem) => ({
          type: "ColumnSet",
          spacing: "Small",
          columns: [
            {
              type: "Column",
              width: "auto",
              items: [
                {
                  type: "TextBlock",
                  text: "☑️",
                  size: "Small"
                }
              ]
            },
            {
              type: "Column",
              width: "stretch",
              items: [
                {
                  type: "TextBlock",
                  text: item.task,
                  wrap: true,
                  size: "Small"
                },
                {
                  type: "TextBlock",
                  text: `Assigned to: ${item.assignee}${item.dueDate ? ` • Due: ${new Date(item.dueDate).toLocaleDateString()}` : ''}`,
                  size: "Small",
                  color: "Default",
                  isSubtle: true,
                  wrap: true
                }
              ]
            }
          ]
        })),
        ...(actionItems.length > 5 ? [{
          type: "TextBlock",
          text: `+${actionItems.length - 5} more action items`,
          size: "Small",
          isSubtle: true,
          spacing: "Small"
        }] : [])
      ] : [])
    ],
    actions: [
      ...(minutes.docxUrl ? [{
        type: "Action.OpenUrl",
        title: "View DOCX",
        url: minutes.docxUrl,
        iconUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Microsoft_Office_Word_%282019%E2%80%93present%29.svg/32px-Microsoft_Office_Word_%282019%E2%80%93present%29.svg.png"
      }] : []),
      ...(minutes.pdfUrl ? [{
        type: "Action.OpenUrl",
        title: "View PDF",
        url: minutes.pdfUrl,
        iconUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/PDF_file_icon.svg/32px-PDF_file_icon.svg.png"
      }] : []),
      ...(minutes.sharepointUrl ? [{
        type: "Action.OpenUrl",
        title: "Open in SharePoint",
        url: minutes.sharepointUrl,
        iconUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Microsoft_Office_SharePoint_%282019%E2%80%93present%29.svg/32px-Microsoft_Office_SharePoint_%282019%E2%80%93present%29.svg.png"
      }] : []),
      {
        type: "Action.OpenUrl",
        title: "View Full Details",
        url: `${process.env.PUBLIC_URL || 'https://teams-minutes.azurewebsites.net'}/meetings/${meeting.id}`
      }
    ]
  };
}

export function createMeetingProcessingCard(
  meeting: Meeting,
  status: 'processing' | 'completed' | 'failed',
  message: string
): any {
  const statusConfig = {
    processing: {
      emoji: "⏳",
      color: "Accent",
      title: "Processing Meeting"
    },
    completed: {
      emoji: "✅",
      color: "Good",
      title: "Meeting Processed"
    },
    failed: {
      emoji: "⚠️",
      color: "Attention",
      title: "Processing Failed"
    }
  };

  const config = statusConfig[status];

  return {
    type: "AdaptiveCard",
    version: "1.4",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    body: [
      {
        type: "Container",
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "auto",
                items: [
                  {
                    type: "TextBlock",
                    text: config.emoji,
                    size: "ExtraLarge"
                  }
                ]
              },
              {
                type: "Column",
                width: "stretch",
                items: [
                  {
                    type: "TextBlock",
                    text: config.title,
                    weight: "Bolder",
                    size: "Large",
                    color: config.color
                  },
                  {
                    type: "TextBlock",
                    text: meeting.title,
                    weight: "Bolder",
                    wrap: true
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: "TextBlock",
        text: message,
        wrap: true,
        spacing: "Medium"
      },
      {
        type: "FactSet",
        facts: [
          {
            title: "Meeting Date:",
            value: new Date(meeting.scheduledAt).toLocaleString()
          },
          {
            title: "Duration:",
            value: meeting.duration
          }
        ]
      }
    ]
  };
}
