/**
 * Processing Validation Service
 * 
 * IMPORTANT: All thresholds have been removed per user requirement.
 * Every meeting is processed, regardless of duration or transcript length.
 * 
 * Audit Trail:
 * - Every processing decision is logged with reason
 * - Manual override capability for admin intervention
 */

import { db } from "../db";
import { meetings } from "@shared/schema";
import { eq } from "drizzle-orm";

// Processing thresholds - ALL REMOVED per user requirement
// Every meeting is processed, no exceptions
export const PROCESSING_THRESHOLDS = {
  MIN_DURATION_SECONDS: 0, // No minimum - process all meetings
  MIN_TRANSCRIPT_WORDS: 0, // No minimum - process all meetings
};

/**
 * Processing decision result
 */
export interface ProcessingDecision {
  shouldProcess: boolean;
  decision: "pending" | "processed" | "skipped_duration" | "skipped_content" | "skipped_no_transcript" | "manual_override";
  reason: string;
  actualDurationSeconds?: number;
  transcriptWordCount?: number;
}

/**
 * Count words in transcript text
 * Handles VTT format by stripping timestamps and metadata
 */
export function countTranscriptWords(transcript: string | null | undefined): number {
  if (!transcript || transcript.trim().length === 0) {
    return 0;
  }

  // Remove VTT headers and timestamps
  // VTT format: "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nSpeaker: Text here"
  const cleanedText = transcript
    // Remove WEBVTT header
    .replace(/^WEBVTT[\s\S]*?\n\n/i, "")
    // Remove timestamp lines (00:00:00.000 --> 00:00:05.000)
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, "")
    // Remove speaker labels if they're on their own line
    .replace(/^<v\s+[^>]+>/gm, "")
    .replace(/<\/v>/g, "")
    // Remove cue identifiers (numeric or UUID)
    .replace(/^[a-f0-9-]{36}$/gmi, "")
    .replace(/^\d+$/gm, "")
    // Clean up extra whitespace
    .replace(/\s+/g, " ")
    .trim();

  if (cleanedText.length === 0) {
    return 0;
  }

  // Count words (split by whitespace)
  const words = cleanedText.split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/**
 * Calculate actual meeting duration from call record
 * Returns duration in seconds
 */
export function calculateActualDuration(startTime: Date | string | null, endTime: Date | string | null): number | null {
  if (!startTime || !endTime) {
    return null;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return null;
  }

  const durationMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(durationMs / 1000));
}

/**
 * Validate meeting for AI processing
 * 
 * IMPORTANT: All thresholds removed. Every meeting is processed.
 * Only requirement: transcript must exist (can't generate minutes from nothing)
 */
export function validateForProcessing(
  actualDurationSeconds: number | null,
  transcriptWordCount: number | null,
  hasTranscript: boolean
): ProcessingDecision {
  // Only check: transcript must exist (can't generate minutes from nothing)
  if (!hasTranscript) {
    return {
      shouldProcess: false,
      decision: "skipped_no_transcript",
      reason: `No transcript available. Transcription must be enabled during the meeting for AI minutes generation.`,
      actualDurationSeconds: actualDurationSeconds ?? undefined,
      transcriptWordCount: 0,
    };
  }

  // ALL THRESHOLDS REMOVED - Process every meeting with a transcript
  // No duration checks, no word count checks
  const durationMinutes = actualDurationSeconds ? Math.floor(actualDurationSeconds / 60) : 0;
  const durationSeconds = actualDurationSeconds ? actualDurationSeconds % 60 : 0;
  
  return {
    shouldProcess: true,
    decision: "processed",
    reason: `Meeting will be processed. Duration: ${durationMinutes}m ${durationSeconds}s, Transcript: ${transcriptWordCount ?? 0} words. (No thresholds applied)`,
    actualDurationSeconds: actualDurationSeconds ?? undefined,
    transcriptWordCount: transcriptWordCount ?? undefined,
  };
}

/**
 * Record processing decision in database for audit trail
 */
export async function recordProcessingDecision(
  meetingId: string,
  decision: ProcessingDecision
): Promise<void> {
  const timestamp = new Date();

  console.log(`📋 [Processing Audit] Meeting ${meetingId}: ${decision.decision}`);
  console.log(`   Reason: ${decision.reason}`);
  if (decision.actualDurationSeconds !== undefined) {
    console.log(`   Duration: ${decision.actualDurationSeconds}s (${Math.floor(decision.actualDurationSeconds / 60)}m)`);
  }
  if (decision.transcriptWordCount !== undefined) {
    console.log(`   Transcript words: ${decision.transcriptWordCount}`);
  }

  await db.update(meetings)
    .set({
      actualDurationSeconds: decision.actualDurationSeconds ?? null,
      transcriptWordCount: decision.transcriptWordCount ?? null,
      processingDecision: decision.decision,
      processingDecisionReason: decision.reason,
      processingDecisionAt: timestamp,
    })
    .where(eq(meetings.id, meetingId));
}

/**
 * Record manual override decision for audit trail
 */
export async function recordManualOverride(
  meetingId: string,
  adminUserId: string,
  overrideReason: string
): Promise<void> {
  const timestamp = new Date();
  const reason = `Manual override by admin ${adminUserId}: ${overrideReason}`;

  console.log(`📋 [Processing Audit] Meeting ${meetingId}: manual_override`);
  console.log(`   ${reason}`);

  await db.update(meetings)
    .set({
      processingDecision: "manual_override",
      processingDecisionReason: reason,
      processingDecisionAt: timestamp,
    })
    .where(eq(meetings.id, meetingId));
}

/**
 * Get meeting processing status for display
 */
export async function getProcessingStatus(meetingId: string): Promise<{
  decision: string | null;
  reason: string | null;
  decisionAt: Date | null;
  actualDurationSeconds: number | null;
  transcriptWordCount: number | null;
} | null> {
  const [meeting] = await db.select({
    decision: meetings.processingDecision,
    reason: meetings.processingDecisionReason,
    decisionAt: meetings.processingDecisionAt,
    actualDurationSeconds: meetings.actualDurationSeconds,
    transcriptWordCount: meetings.transcriptWordCount,
  })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!meeting) {
    return null;
  }

  return meeting;
}

export const processingValidationService = {
  PROCESSING_THRESHOLDS,
  countTranscriptWords,
  calculateActualDuration,
  validateForProcessing,
  recordProcessingDecision,
  recordManualOverride,
  getProcessingStatus,
};
