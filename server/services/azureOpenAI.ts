/**
 * Azure OpenAI Service
 * 
 * Provides AI capabilities using Azure OpenAI Service exclusively.
 * Production deployment: Azure Container Apps with Azure OpenAI.
 */
import { AzureOpenAI } from "openai";
import pRetry, { AbortError } from "p-retry";
import { getConfig } from "./configValidator";

let azureClient: AzureOpenAI | null = null;

function getAIClient(): AzureOpenAI {
  const config = getConfig();
  
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
    throw new Error(
      "[CONFIGURATION ERROR] Azure OpenAI credentials not configured. " +
      "Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables."
    );
  }
  
  if (!azureClient) {
    azureClient = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"
    });
  }
  
  return azureClient;
}

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export async function generateMeetingMinutes(transcript: string): Promise<{
  summary: string;
  keyDiscussions: string[];
  decisions: string[];
}> {
  const client = getAIClient();

  return await pRetry(
    async () => {
      try {
        const response = await client.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an AI assistant helping to generate professional meeting minutes. 
Analyze the provided meeting transcript and generate a concise, professional summary.

Requirements:
- Use formal, professional language
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
          max_tokens: 8192,
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content || "{}";
        return JSON.parse(content);
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

export async function extractActionItems(transcript: string): Promise<Array<{
  task: string;
  assignee: string;
  dueDate: string | null;
  priority: string;
}>> {
  const client = getAIClient();

  return await pRetry(
    async () => {
      try {
        const response = await client.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
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
          max_tokens: 4096,
          response_format: { type: "json_object" }
        });

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
