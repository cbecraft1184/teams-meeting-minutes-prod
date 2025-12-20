import { AzureOpenAI } from "openai";
import OpenAI from "openai";
import pRetry, { AbortError } from "p-retry";

// Lazy initialization of Azure OpenAI client (only in production with proper credentials)
let azureClient: AzureOpenAI | null = null;
let replitAIClient: OpenAI | null = null;

function getAIClient(): AzureOpenAI | OpenAI {
  // Production: Use Azure OpenAI Government Cloud
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
    if (!azureClient) {
      azureClient = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview",
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4-teams-minutes"
      });
    }
    return azureClient;
  }
  
  // Development fallback: Use Replit AI Integrations
  if (!replitAIClient) {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      throw new Error(
        "Neither Azure OpenAI nor Replit AI credentials found. " +
        "For production: Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT. " +
        "For development: Ensure Replit AI Integrations are enabled."
      );
    }
    replitAIClient = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });
  }
  return replitAIClient;
}

function isUsingAzure(): boolean {
  return !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT);
}

// Helper function to check if error is rate limit or quota violation
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

// Detail level type for meeting minutes generation
export type DetailLevel = "low" | "medium" | "high";

// Get detail-level-specific instructions for the AI
function getDetailLevelInstructions(detailLevel: DetailLevel): string {
  switch (detailLevel) {
    case "low":
      return `
DETAIL LEVEL: LOW (Executive Summary)
- Generate a CONCISE executive summary (2-3 paragraphs max)
- Include ONLY the most critical, high-level takeaways
- Limit keyDiscussions to 3-5 MOST important points only
- Limit decisions to critical, high-impact decisions only
- Focus on strategic outcomes, not tactical details
- Be extremely brief and to the point`;
    
    case "medium":
      return `
DETAIL LEVEL: MEDIUM (Standard Summary)
- Generate a balanced summary covering main topics
- Include medium and high-level discussion points
- Limit keyDiscussions to 5-8 key points
- Include all significant decisions
- Balance brevity with completeness`;
    
    case "high":
      return `
DETAIL LEVEL: HIGH (Comprehensive)
- Generate a thorough, detailed summary
- Include ALL discussion points: low, medium, and high-level
- Capture granular details and nuances from the discussion
- Include all decisions, even minor ones
- Document the full context and reasoning behind discussions
- Be comprehensive and thorough`;
    
    default:
      return getDetailLevelInstructions("medium");
  }
}

// Generate meeting minutes from transcript
// Uses Azure OpenAI Government in production, Replit AI in development
export async function generateMeetingMinutes(
  transcript: string,
  detailLevel: DetailLevel = "medium"
): Promise<{
  summary: string;
  keyDiscussions: string[];
  decisions: string[];
  simulatedSpeakers: string[];
}> {
  const client = getAIClient();
  const usingAzure = isUsingAzure();
  
  if (!usingAzure) {
    console.warn("⚠️  Using Replit AI (development). Production MUST use Azure OpenAI Government.");
  }

  const detailInstructions = getDetailLevelInstructions(detailLevel);
  console.log(`📊 [AI] Generating minutes with detail level: ${detailLevel}`);

  return await pRetry(
    async () => {
      try {
        const createParams: any = {
          messages: [
            {
              role: "system",
              content: `You are an AI assistant helping to generate professional meeting minutes. 
Analyze the provided meeting transcript and generate a professional summary.

${detailInstructions}

IMPORTANT DISTINCTIONS:
- "decisions": Final conclusions, agreements, or choices made during the meeting. Example: "Approved the new branding colors", "Agreed to postpone launch to Q2"
- "keyDiscussions": Topics discussed, debates, or information shared. NOT action items.
- "simulatedSpeakers": For SOLO TEST meetings only - extract names when someone says "[Name] speaking" (e.g., "Alex speaking", "Alice speaking"). 
  This is used when one person is role-playing multiple participants in a test scenario.
  Only include names that appear with the pattern "[Name] speaking" - NOT regular speaker labels or mentions.
  If no "[Name] speaking" patterns are found, return an empty array.

DO NOT include action items (tasks assigned to people) in the decisions field. Action items are extracted separately.

Requirements:
- Use formal, professional language
- Decisions are ONLY final conclusions/agreements reached, not tasks to be done
- Maintain security classification awareness
- For simulatedSpeakers: ONLY extract names from "[Name] speaking" patterns used in solo test scenarios
- Structure output as JSON with these fields: summary, keyDiscussions, decisions, simulatedSpeakers

Output JSON format:
{
  "summary": "Brief overall summary of the meeting purpose and outcome",
  "keyDiscussions": ["Topic discussed 1", "Topic discussed 2"],
  "decisions": ["Final agreement or conclusion 1", "Final agreement or conclusion 2"],
  "simulatedSpeakers": ["Alex", "Alice"]
}`
            },
            {
              role: "user",
              content: `Generate meeting minutes from this transcript:\n\n${transcript}`
            }
          ],
          response_format: { type: "json_object" }
        };

        // Azure uses max_tokens, Replit AI uses max_completion_tokens
        if (usingAzure) {
          createParams.max_tokens = 8192;
        } else {
          createParams.model = "gpt-4o";
          createParams.max_completion_tokens = 8192;
        }

        const response = await client.chat.completions.create(createParams);
        const content = response.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(content);
        // Ensure simulatedSpeakers is always an array
        return {
          ...parsed,
          simulatedSpeakers: parsed.simulatedSpeakers || []
        };
      } catch (error: any) {
        console.error("Azure OpenAI error:", error);
        if (isRateLimitError(error)) {
          throw error; // Rethrow to trigger p-retry
        }
        throw new AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
      onFailedAttempt: (error) => {
        console.warn(`Azure OpenAI attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      }
    }
  );
}

// Extract action items from transcript
// Uses Azure OpenAI Government in production, Replit AI in development
export async function extractActionItems(transcript: string, attendees?: string[], meetingDate?: Date): Promise<Array<{
  task: string;
  assignee: string;
  dueDate: string | null;
  priority: string;
}>> {
  const client = getAIClient();
  const usingAzure = isUsingAzure();
  
  if (!usingAzure) {
    console.warn("⚠️  Using Replit AI (development). Production MUST use Azure OpenAI Government.");
  }

  // Build attendee list for the prompt - numbered for clarity
  const attendeeList = attendees && attendees.length > 0 
    ? `\n\nMEETING ATTENDEES (use EXACTLY one of these names as assignee):\n${attendees.map((a, i) => `${i + 1}. "${a}"`).join('\n')}`
    : '';

  // Provide meeting date context for relative date parsing
  const refDate = meetingDate || new Date();
  const dateContext = `\n\nMEETING DATE: ${refDate.toISOString().split('T')[0]} (${refDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})`;

  return await pRetry(
    async () => {
      try {
        const createParams: any = {
          messages: [
            {
              role: "system",
              content: `You are an expert at extracting ONLY explicitly assigned action items from meeting transcripts.

WHAT IS AN ACTION ITEM:
An action item is a SPECIFIC TASK explicitly assigned to a SPECIFIC PERSON with a CLEAR DELIVERABLE.
Look for these patterns:
- "[Person], please [do task]" - EXPLICIT assignment
- "[Person], can you [do task]" followed by agreement - EXPLICIT assignment
- "Please [do task] by [date]" directed at someone - EXPLICIT assignment
- "[Person] will [do task]" as a commitment - EXPLICIT assignment

WHAT IS NOT AN ACTION ITEM (DO NOT EXTRACT):
- General discussions or status updates ("we discussed X", "the team is working on Y")
- Questions without task assignments ("have you looked at this?")
- Vague references ("someone should look into this")
- Past actions already completed ("Abdul and I have been on it")
- Ongoing work without new assignment ("we're proceeding with testing")
- Group responsibilities without individual assignment

ASSIGNEE MATCHING RULES - CRITICAL:
1. When a first name is mentioned (e.g., "Vamsi, can you..."), find the FULL NAME from the attendee list that starts with that first name
2. Example: "Vamsi, can you work with James" + attendee "Vamsi Pathri" → assignee = "Vamsi Pathri"
3. Example: "Ban, please write up" + attendee "Ban Chou" → assignee = "Ban Chou"
4. Example: "Ricky, please provide final approval" + attendee "Ricky" → assignee = "Ricky"
5. The meeting leader/moderator (usually "Chris" in this format) assigns tasks - they are NOT the assignee unless explicitly taking a task
6. NEVER use usernames, emails, or identifiers - only use names from the attendee list
7. If you cannot match the name to someone in the attendee list, use "Unassigned"
${attendeeList}

DUE DATE RULES - CONVERT ALL RELATIVE DATES:
Use the MEETING DATE provided as reference:
- "Wednesday, December 17th" or "December 17th" → "2023-12-17"
- "Thursday, December 18th" → "2023-12-18"  
- "Friday, December 19th" → "2023-12-19"
- "by [day], [month] [date]" → extract the actual date
- "EOD" = end of day (include in task description)
- "10 AM EST" = include time in task description
- "immediately after this meeting" → use meeting date with note in task
- If no specific date, use null
${dateContext}

PRIORITY RULES:
- "high": Urgent, blocking, or has tight deadline
- "medium": Standard importance, clear deadline but not urgent
- "low": Nice-to-have or flexible timing

Output as JSON:
{
  "items": [
    {
      "task": "Clear, actionable task description",
      "assignee": "EXACT full name from attendee list",
      "dueDate": "YYYY-MM-DD or null",
      "priority": "high|medium|low"
    }
  ]
}`
            },
            {
              role: "user",
              content: transcript
            }
          ],
          response_format: { type: "json_object" }
        };

        // Azure uses max_tokens, Replit AI uses max_completion_tokens
        if (usingAzure) {
          createParams.max_tokens = 4096;
        } else {
          createParams.model = "gpt-4o";
          createParams.max_completion_tokens = 4096;
        }

        const response = await client.chat.completions.create(createParams);
        const content = response.choices[0]?.message?.content || '{"items":[]}';
        const parsed = JSON.parse(content);
        return parsed.items || parsed.actionItems || [];
      } catch (error: any) {
        console.error("Azure OpenAI error:", error);
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
      onFailedAttempt: (error) => {
        console.warn(`Azure OpenAI attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      }
    }
  );
}
