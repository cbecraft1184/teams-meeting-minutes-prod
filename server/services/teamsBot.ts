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
  private adapter: BotFrameworkAdapter;
  private bot: TeamsMeetingBot;

  constructor() {
    const appId = process.env.MICROSOFT_APP_ID;
    const appPassword = process.env.MICROSOFT_APP_PASSWORD;

    if (!appId || !appPassword) {
      console.warn('⚠️  [Teams Bot] MICROSOFT_APP_ID or MICROSOFT_APP_PASSWORD not set - bot disabled');
    }

    this.adapter = new BotFrameworkAdapter({
      appId,
      appPassword,
    });

    this.adapter.onTurnError = async (context, error) => {
      console.error(`\n [Bot onTurnError] unhandled error: ${error}`);
      await context.sendActivity('The bot encountered an error.');
    };

    this.bot = new TeamsMeetingBot();
  }

  async processActivity(req: any, res: any) {
    await this.adapter.process(req, res, async (context) => {
      await this.bot.run(context);
    });
  }

  async sendProactiveMessage(
    conversationReference: ConversationReference,
    messageOrActivity: string | Partial<Activity>
  ): Promise<void> {
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
            '👋 Welcome! I\'m the Meeting Minutes bot. I automatically capture Teams meetings and generate AI-powered minutes.'
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
          'Thanks for installing Meeting Minutes! I\'ll automatically post AI-generated summaries to this channel when meetings are processed.'
        );
      }
      await next();
    });
  }

  async handleTeamsMessagingExtensionQuery(
    context: TurnContext,
    query: MessagingExtensionQuery
  ): Promise<MessagingExtensionResponse> {
    const searchQuery = query.parameters?.[0]?.value || '';

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
            ilike(meetings.title, `%${searchQuery}%`)
          )
        )
        .orderBy(desc(meetings.scheduledAt))
        .limit(10);

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
        });
        
        console.log(`Saved conversation reference for ${conversationType}: ${teamName || conversationId}`);
      }
    } catch (error) {
      console.error('Error saving conversation reference:', error);
    }
  }
}

export const teamsBotAdapter = new TeamsBotAdapter();
