// Reference: blueprint:javascript_openai_ai_integrations
import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry from "p-retry";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

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
export async function generateMeetingMinutes(transcript: string): Promise<{
  summary: string;
  keyDiscussions: string[];
  decisions: string[];
}> {
  return await pRetry(
    async () => {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
          messages: [
            {
              role: "system",
              content: `You are an AI assistant helping to generate meeting minutes for DOD meetings. 
Analyze the provided meeting transcript and generate a concise, professional summary.

Requirements:
- Use formal, government-appropriate language
- Focus on key decisions and action items
- Maintain security classification awareness
- Structure output as JSON with these fields: summary, keyDiscussions, decisions

Output JSON format:
{
  "summary": "Brief overall summary",
  "keyDiscussions": ["Discussion point 1", "Discussion point 2"],
  "decisions": ["Decision 1", "Decision 2"]
}`
            },
            {
              role: "user",
              content: `Generate meeting minutes from this transcript:\n\n${transcript}`
            }
          ],
          max_completion_tokens: 8192,
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content || "{}";
        return JSON.parse(content);
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error; // Rethrow to trigger p-retry
        }
        throw new pRetry.AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
    }
  );
}

// Extract action items from transcript
export async function extractActionItems(transcript: string): Promise<Array<{
  task: string;
  assignee: string;
  dueDate: string | null;
  priority: string;
}>> {
  return await pRetry(
    async () => {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
          messages: [
            {
              role: "system",
              content: `Extract action items from this meeting transcript. For each action item, identify:
- The task to be completed
- The person assigned (if mentioned)
- Any deadlines mentioned
- Priority level (high/medium/low based on context)

Output as JSON array:
[
  {
    "task": "Description of task",
    "assignee": "Name or 'Unassigned'",
    "dueDate": "YYYY-MM-DD or null",
    "priority": "high|medium|low"
  }
]`
            },
            {
              role: "user",
              content: transcript
            }
          ],
          max_completion_tokens: 4096,
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content || '{"items":[]}';
        const parsed = JSON.parse(content);
        return parsed.items || parsed.actionItems || [];
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw new pRetry.AbortError(error);
      }
    },
    {
      retries: 7,
      minTimeout: 2000,
      maxTimeout: 128000,
      factor: 2,
    }
  );
}
