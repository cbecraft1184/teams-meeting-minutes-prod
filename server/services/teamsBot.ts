import { 
  BotFrameworkAdapter, 
  TurnContext, 
  TeamsActivityHandler,
  CardFactory,
  ConversationReference,
  Activity,
  MessageFactory,
  MessagingExtensionQuery,
  MessagingExtensionResponse,
  CardAction
} from 'botbuilder';
import { db } from '../db';
import { teamsConversationReferences, meetings, meetingMinutes } from '@shared/schema';
import { eq, ilike, desc, and } from 'drizzle-orm';

export class TeamsBotAdapter {
  private adapter: BotFrameworkAdapter | null = null;
  private bot: TeamsMeetingBot | null = null;
  private isEnabled: boolean = false;

  constructor() {
    const appId = process.env.MICROSOFT_APP_ID;
    const appPassword = process.env.MICROSOFT_APP_PASSWORD;

    if (!appId || !appPassword) {
      console.warn('[Teams Bot] MICROSOFT_APP_ID or MICROSOFT_APP_PASSWORD not set - Teams bot features disabled');
      return;
    }

    try {
      this.adapter = new BotFrameworkAdapter({
        appId,
        appPassword,
      });

      this.adapter.onTurnError = async (context, error) => {
        console.error(`\n [Bot onTurnError] unhandled error: ${error}`);
        await context.sendActivity('The bot encountered an error.');
      };

      this.bot = new TeamsMeetingBot();
      this.isEnabled = true;
      console.log('[Teams Bot] Initialized successfully');
    } catch (error) {
      console.error('[Teams Bot] Initialization failed:', error);
      this.isEnabled = false;
    }
  }

  async processActivity(req: any, res: any) {
    if (!this.adapter || !this.bot) {
      res.status(503).send('Teams bot not configured');
      return;
    }

    await this.adapter.process(req, res, async (context) => {
      await this.bot!.run(context);
    });
  }

  async sendProactiveMessage(
    conversationReference: ConversationReference,
    messageOrActivity: string | Partial<Activity>
  ): Promise<void> {
    if (!this.adapter || !this.isEnabled) {
      console.warn('[Teams Bot] Skipping proactive message - bot not configured');
      return;
    }

    await this.adapter.continueConversationAsync(
      process.env.MICROSOFT_APP_ID!,
      conversationReference,
      async (context) => {
        if (typeof messageOrActivity === 'string') {
          await context.sendActivity(messageOrActivity);
        } else {
          await context.sendActivity(messageOrActivity as Activity);
        }
      }
    );
  }

  async sendAdaptiveCard(
    conversationReference: ConversationReference,
    cardPayload: any
  ): Promise<void> {
    if (!this.isEnabled) {
      console.warn('[Teams Bot] Skipping Adaptive Card - bot not configured');
      return;
    }

    const card = CardFactory.adaptiveCard(cardPayload);
    await this.sendProactiveMessage(conversationReference, {
      attachments: [card],
    });
  }
}

class TeamsMeetingBot extends TeamsActivityHandler {
  constructor() {
    super();

    this.onConversationUpdate(async (context, next) => {
      const added = context.activity.membersAdded || [];
      
      for (const member of added) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity(
            'Welcome! I am the Meeting Minutes bot. I automatically capture Teams meetings and generate AI-powered minutes.'
          );
        }
      }

      await this.saveConversationReference(context);
      await next();
    });

    this.onMessage(async (context, next) => {
      const text = context.activity.text?.trim().toLowerCase() || '';
      
      if (text === 'help') {
        await context.sendActivity(
          'I automatically capture meeting recordings and generate minutes. Use @MeetingMinutes in the compose box to search archived minutes.'
        );
      }

      await next();
    });

    this.onInstallationUpdate(async (context, next) => {
      if (context.activity.action === 'add') {
        await this.saveConversationReference(context);
        await context.sendActivity(
          'Meeting Minutes installed successfully. I will automatically post AI-generated summaries to this channel when meetings are processed.'
        );
      }
      await next();
    });
  }

  async handleTeamsMessagingExtensionQuery(
    context: TurnContext,
    query: MessagingExtensionQuery
  ): Promise<MessagingExtensionResponse> {
    const searchQuery = query.parameters?.[0]?.value?.trim() || '';

    if (!searchQuery || searchQuery.length < 2) {
      return {
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments: [],
          text: 'Please enter at least 2 characters to search',
        },
      };
    }

    if (searchQuery.length > 100) {
      return {
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments: [],
          text: 'Search query too long (max 100 characters)',
        },
      };
    }

    try {
      const results = await db
        .select({
          meeting: meetings,
          minutes: meetingMinutes,
        })
        .from(meetings)
        .leftJoin(meetingMinutes, eq(meetings.id, meetingMinutes.meetingId))
        .where(
          and(
            eq(meetingMinutes.approvalStatus, 'approved'),
            ilike(meetings.title, `%${searchQuery.substring(0, 100)}%`)
          )
        )
        .orderBy(desc(meetings.scheduledAt))
        .limit(8);

      const attachments = results
        .filter(r => r.minutes)
        .map(({ meeting, minutes }) => {
          const previewCard = CardFactory.heroCard(
            meeting.title,
            minutes!.summary.substring(0, 150) + '...',
            [],
            [],
            {
              subtitle: new Date(meeting.scheduledAt).toLocaleDateString(),
              text: `${minutes!.attendeesPresent.length} attendees • ${meeting.duration}`,
            }
          );

          const detailCard = CardFactory.adaptiveCard({
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                text: meeting.title,
                weight: 'Bolder',
                size: 'Large',
              },
              {
                type: 'FactSet',
                facts: [
                  { title: 'Date', value: new Date(meeting.scheduledAt).toLocaleString() },
                  { title: 'Duration', value: meeting.duration },
                  { title: 'Attendees', value: minutes!.attendeesPresent.join(', ') },
                ],
              },
              {
                type: 'TextBlock',
                text: minutes!.summary,
                wrap: true,
              },
            ],
            actions: minutes!.docxUrl || minutes!.pdfUrl ? [
              ...(minutes!.docxUrl ? [{
                type: 'Action.OpenUrl',
                title: 'View DOCX',
                url: minutes!.docxUrl,
              }] : []),
              ...(minutes!.pdfUrl ? [{
                type: 'Action.OpenUrl',
                title: 'View PDF',
                url: minutes!.pdfUrl,
              }] : []),
            ] : undefined,
          });

          return {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: detailCard.content,
            preview: previewCard,
          };
        });

      return {
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments,
        },
      };
    } catch (error) {
      console.error('[Message Extension] Search error:', error);
      return {
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments: [],
        },
      };
    }
  }

  private async saveConversationReference(context: TurnContext): Promise<void> {
    const reference = TurnContext.getConversationReference(context.activity);
    const conversationId = reference.conversation?.id || '';
    const serviceUrl = reference.serviceUrl || '';
    const tenantId = context.activity.conversation?.tenantId || '';

    const teamsChannelData = context.activity.channelData as any;
    const teamId = teamsChannelData?.team?.id;
    const teamName = teamsChannelData?.team?.name;
    const channelName = teamsChannelData?.channel?.name;
    
    const conversationType = reference.conversation?.conversationType || 'personal';

    try {
      const existing = await db.query.teamsConversationReferences.findFirst({
        where: eq(teamsConversationReferences.conversationId, conversationId),
      });

      if (!existing) {
        // Calculate expiration: 90 days from now (TTL for conversation references)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);
        
        await db.insert(teamsConversationReferences).values({
          conversationId,
          serviceUrl,
          tenantId,
          channelId: 'msteams',
          conversationType,
          teamId,
          teamName,
          channelName,
          conversationReference: reference as any,
          expiresAt,
        });
        
        console.log(`Saved conversation reference for ${conversationType}: ${teamName || conversationId}`);
      }
    } catch (error) {
      console.error('Error saving conversation reference:', error);
    }
  }
}

export const teamsBotAdapter = new TeamsBotAdapter();
