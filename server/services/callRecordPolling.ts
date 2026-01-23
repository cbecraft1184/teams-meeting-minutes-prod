/**
 * Call Record Polling Service
 * 
 * Active polling for call records from Microsoft Graph API as a backup
 * to webhooks. This ensures meetings are captured even if webhooks fail
 * or are delayed.
 * 
 * Runs every 2 minutes to check for new call records.
 */

import { db } from "../db";
import { meetings } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { acquireTokenByClientCredentials, getGraphClient } from "./microsoftIdentity";
import { getConfig } from "./configValidator";
import { enqueueJob } from "./durableQueue";

const POLLING_INTERVAL = 2 * 60 * 1000;
const LOOKBACK_MINUTES = 60;

interface CallRecord {
  id: string;
  startDateTime: string;
  endDateTime: string;
  type: string;
  modalities: string[];
  organizer?: {
    user?: {
      id: string;
      displayName: string;
      userPrincipalName?: string;
    };
  };
  participants?: any[];
  joinWebUrl?: string;
}

let pollingInterval: NodeJS.Timeout | null = null;
let lastPollTime: Date | null = null;

export async function pollForNewCallRecords(): Promise<{ found: number; processed: number }> {
  const config = getConfig();
  
  if (config.useMockServices || !config.graph.clientId) {
    console.log("[CallRecordPoll] Skipping - mock mode or Graph not configured");
    return { found: 0, processed: 0 };
  }
  
  try {
    console.log("[CallRecordPoll] Polling for new call records...");
    
    const accessToken = await acquireTokenByClientCredentials([
      "https://graph.microsoft.com/.default"
    ]);
    
    if (!accessToken) {
      console.error("[CallRecordPoll] Failed to acquire access token");
      return { found: 0, processed: 0 };
    }
    
    const graphClient = await getGraphClient(accessToken);
    if (!graphClient) {
      console.error("[CallRecordPoll] Failed to get Graph client");
      return { found: 0, processed: 0 };
    }
    
    const lookbackTime = new Date();
    lookbackTime.setMinutes(lookbackTime.getMinutes() - LOOKBACK_MINUTES);
    const filterTime = lookbackTime.toISOString();
    
    let callRecords: CallRecord[] = [];
    try {
      const encodedFilter = encodeURIComponent(`endDateTime ge ${filterTime}`);
      const response = await graphClient.get(
        `/communications/callRecords?$filter=${encodedFilter}&$orderby=endDateTime desc&$top=50`
      );
      callRecords = response?.value || [];
      
      // Handle pagination if there are more results
      let nextLink = response?.["@odata.nextLink"];
      while (nextLink && callRecords.length < 200) {
        const nextResponse = await graphClient.get(nextLink.replace("https://graph.microsoft.com/v1.0", ""));
        callRecords = callRecords.concat(nextResponse?.value || []);
        nextLink = nextResponse?.["@odata.nextLink"];
      }
    } catch (apiError: any) {
      if (apiError?.status === 403 || apiError?.message?.includes("403")) {
        console.warn("[CallRecordPoll] CallRecords.Read.All permission not granted - polling disabled");
        return { found: 0, processed: 0 };
      }
      console.error("[CallRecordPoll] Graph API error:", apiError?.message || apiError);
      throw apiError;
    }
    
    console.log(`[CallRecordPoll] Found ${callRecords.length} call records in last ${LOOKBACK_MINUTES} minutes`);
    
    let processedCount = 0;
    
    for (const callRecord of callRecords) {
      const existingMeeting = await db.select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.callRecordId, callRecord.id))
        .limit(1);
      
      if (existingMeeting.length > 0) {
        continue;
      }
      
      if (!callRecord.modalities?.includes("audio") && !callRecord.modalities?.includes("video")) {
        continue;
      }
      
      try {
        const jobId = await enqueueJob({
          jobType: "process_call_record",
          idempotencyKey: `poll:callrecord:${callRecord.id}`,
          payload: {
            callRecordId: callRecord.id,
            resource: `communications/callRecords/${callRecord.id}`,
            tenantId: config.graph.tenantId,
            changeType: "created",
            source: "polling"
          },
          maxRetries: 5
        });
        
        if (jobId) {
          processedCount++;
          console.log(`[CallRecordPoll] Enqueued new call record: ${callRecord.id}`);
        }
      } catch (error: any) {
        if (!error.message?.includes("duplicate key")) {
          console.error(`[CallRecordPoll] Failed to enqueue ${callRecord.id}:`, error.message);
        }
      }
    }
    
    lastPollTime = new Date();
    console.log(`[CallRecordPoll] Complete: ${processedCount} new call records enqueued`);
    
    return { found: callRecords.length, processed: processedCount };
    
  } catch (error) {
    console.error("[CallRecordPoll] Error polling call records:", error);
    return { found: 0, processed: 0 };
  }
}

export function startCallRecordPolling(): void {
  if (pollingInterval) {
    console.log("[CallRecordPoll] Already running");
    return;
  }
  
  console.log(`[CallRecordPoll] Starting polling (every ${POLLING_INTERVAL / 1000} seconds)`);
  
  setTimeout(() => pollForNewCallRecords(), 5000);
  
  pollingInterval = setInterval(async () => {
    await pollForNewCallRecords();
  }, POLLING_INTERVAL);
}

export function stopCallRecordPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[CallRecordPoll] Stopped");
  }
}

export function getPollingStatus(): { running: boolean; lastPoll: Date | null; intervalMs: number } {
  return {
    running: pollingInterval !== null,
    lastPoll: lastPollTime,
    intervalMs: POLLING_INTERVAL
  };
}

export const callRecordPollingService = {
  pollForNewCallRecords,
  startCallRecordPolling,
  stopCallRecordPolling,
  getPollingStatus
};
