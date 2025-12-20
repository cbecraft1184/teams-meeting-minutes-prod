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
              content: `You are an AI operations analyst that extracts ONLY explicitly assigned action items from a Microsoft Teams meeting transcript.

DEFINITION — ACTION ITEM (all must hold):
1. A specific person is directly tasked ("<Name>, please…", "<Name> will…", "<Name>, can you…" followed by acceptance).
2. The statement creates a new responsibility with a concrete deliverable.
3. Generic status updates, questions, or past/ongoing work DO NOT count.

ASSIGNEE RULES:
- You will be given MEETING ATTENDEES. Every assignee MUST be copied exactly from that list (case-sensitive) – never invent or shorten.
- Match first-name mentions to the attendee whose name starts with that first name ("Vamsi" → "Vamsi Pathri", "Ban" → "Ban Chou").
- If only a first name exists in the attendee list (e.g., "Ricky"), use that exact first name.
- If multiple people are assigned within one sentence, emit a separate item per person.
- Only output "Unassigned" when absolutely no attendee name can be inferred.
${attendeeList}

DUE DATE RULES (use MEETING DATE as reference):
- Parse explicit calendar dates ("Wednesday, December 17th" → extract year from meeting date context).
- "immediately after this meeting" → use the meeting date.
- Preserve time qualifiers inside the task text ("by Thursday 10 AM EST" → include "by 10 AM EST" in task).
- "EOD" means end of day - include in task text.
- "before noon" → include in task text.
- If no deadline is given, set dueDate to null.
${dateContext}

PRIORITY HEURISTICS:
- high → urgent, deadline ≤ 2 days, or flagged as critical.
- medium → normal commitments with a clear date.
- low → flexible or no deadline.

EXTRACTION PROCESS:
1. Read the transcript sequentially. Capture ONLY sentences that satisfy the ACTION ITEM definition.
2. Split joint assignments into individual items (e.g., "David, please send... Ricky, please provide..." produces two entries).
3. Ensure the final list mirrors the exact commitments present—no more, no less.

OUTPUT FORMAT:
{
  "items": [
    {
      "task": "Clear instruction including any time qualifiers",
      "assignee": "Exact name from attendee list or 'Unassigned'",
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
