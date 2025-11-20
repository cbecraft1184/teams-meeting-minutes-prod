import { 
  BotFrameworkAdapter, 
  TurnContext, 
  TeamsActivityHandler,
  CardFactory,
  ConversationReference,
  Activity,
  MessageFactory
} from 'botbuilder';
import { db } from '../db';
import { teamsConversationReferences } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class TeamsBotAdapter {
  private adapter: BotFrameworkAdapter;
  private bot: TeamsMeetingBot;

  constructor() {
    this.adapter = new BotFrameworkAdapter({
      appId: process.env.MICROSOFT_APP_ID,
      appPassword: process.env.MICROSOFT_APP_PASSWORD,
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
