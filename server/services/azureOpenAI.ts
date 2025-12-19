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

// Generate meeting minutes from transcript
// Uses Azure OpenAI Government in production, Replit AI in development
export async function generateMeetingMinutes(transcript: string): Promise<{
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

  return await pRetry(
    async () => {
      try {
        const createParams: any = {
          messages: [
            {
              role: "system",
              content: `You are an AI assistant helping to generate professional meeting minutes. 
Analyze the provided meeting transcript and generate a concise, professional summary.

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
export async function extractActionItems(transcript: string, attendees?: string[]): Promise<Array<{
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
    ? `\n\nMEETING ATTENDEES (you MUST use one of these EXACT names as assignee):\n${attendees.map((a, i) => `${i + 1}. "${a}"`).join('\n')}`
    : '';

  return await pRetry(
    async () => {
      try {
        const createParams: any = {
          messages: [
            {
              role: "system",
              content: `Extract action items from this meeting transcript. For each action item, identify:
- The task to be completed
- The person assigned (CRITICAL: see rules below)
- Any deadlines mentioned (extract the actual date if stated)
- Priority level (high/medium/low based on context)

ASSIGNEE RULES - FOLLOW EXACTLY:
1. When someone is assigned a task, find the CLOSEST MATCHING full name from the attendee list
2. If the transcript says "Alex will...", find the attendee whose name contains "Alex" (e.g., "Alex Johnson") and use that FULL name
3. If the transcript says "Johnson should...", find the attendee with "Johnson" in their name and use their FULL name
4. NEVER use partial names, first names only, or nicknames - always use the COMPLETE name from the list
5. If no attendee matches the mentioned person, use "Unassigned"
6. If no specific person is mentioned (e.g., "someone needs to", "the team will"), use "Unassigned"
7. Do NOT use generic terms like "team", "leadership", "everyone", or "TBD"
${attendeeList}

Output as JSON:
{
  "items": [
    {
      "task": "Description of task",
      "assignee": "COMPLETE attendee name from list above OR 'Unassigned'",
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
