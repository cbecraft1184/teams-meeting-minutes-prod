/**
 * Processing Validation Service
 * 
 * DOD/Commercial compliance: Validates meetings before AI processing
 * to prevent wasted resources on accidental or invalid meeting sessions.
 * 
 * Thresholds:
 * - Minimum duration: 2 minutes (120 seconds)
 * - Minimum transcript words: 25 words
 * 
 * Audit Trail:
 * - Every processing decision is logged with reason
 * - Manual override capability for admin intervention
 */

import { db } from "../db";
import { meetings } from "@shared/schema";
import { eq } from "drizzle-orm";

// Processing thresholds (configurable via environment variables)
export const PROCESSING_THRESHOLDS = {
  MIN_DURATION_SECONDS: parseInt(process.env.MIN_MEETING_DURATION_SECONDS || "120", 10), // 2 minutes
  MIN_TRANSCRIPT_WORDS: parseInt(process.env.MIN_TRANSCRIPT_WORDS || "25", 10), // 25 words minimum
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
 * Checks duration and transcript content thresholds
 */
export function validateForProcessing(
  actualDurationSeconds: number | null,
  transcriptWordCount: number | null,
  hasTranscript: boolean
): ProcessingDecision {
  // Check if transcript exists
  if (!hasTranscript) {
    return {
      shouldProcess: false,
      decision: "skipped_no_transcript",
      reason: `No transcript available. Transcription must be enabled during the meeting for AI minutes generation.`,
      actualDurationSeconds: actualDurationSeconds ?? undefined,
      transcriptWordCount: 0,
    };
  }

  // Check duration threshold
  if (actualDurationSeconds !== null && actualDurationSeconds < PROCESSING_THRESHOLDS.MIN_DURATION_SECONDS) {
    const durationMinutes = Math.floor(actualDurationSeconds / 60);
    const durationSecondsRemainder = actualDurationSeconds % 60;
    const thresholdMinutes = Math.floor(PROCESSING_THRESHOLDS.MIN_DURATION_SECONDS / 60);

    return {
      shouldProcess: false,
      decision: "skipped_duration",
      reason: `Meeting duration (${durationMinutes}m ${durationSecondsRemainder}s) is below the minimum threshold of ${thresholdMinutes} minutes. This may indicate an accidental meeting open/close.`,
      actualDurationSeconds,
      transcriptWordCount: transcriptWordCount ?? 0,
    };
  }

  // Check transcript content threshold
  if (transcriptWordCount !== null && transcriptWordCount < PROCESSING_THRESHOLDS.MIN_TRANSCRIPT_WORDS) {
    return {
      shouldProcess: false,
      decision: "skipped_content",
      reason: `Transcript content (${transcriptWordCount} words) is below the minimum threshold of ${PROCESSING_THRESHOLDS.MIN_TRANSCRIPT_WORDS} words. Insufficient content for meaningful minutes generation.`,
      actualDurationSeconds: actualDurationSeconds ?? undefined,
      transcriptWordCount,
    };
  }

  // All checks passed
  return {
    shouldProcess: true,
    decision: "processed",
    reason: `Meeting passed all validation checks. Duration: ${actualDurationSeconds ? Math.floor(actualDurationSeconds / 60) : "unknown"}m, Transcript: ${transcriptWordCount ?? "unknown"} words.`,
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
