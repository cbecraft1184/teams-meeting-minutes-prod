/**
 * Backfill Script: Convert attendeesPresent from string[] to AttendeePresent[]
 * 
 * This script converts legacy attendeesPresent data (stored as email strings)
 * to the new format with both name and email as tied objects.
 * 
 * Usage: npx tsx scripts/backfill-attendees.ts [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview changes without writing to database
 */

import { db } from '../server/db';
import { meetingMinutes, meetings } from '../shared/schema';
import { eq, isNotNull } from 'drizzle-orm';
import type { AttendeePresent } from '../shared/attendeeHelpers';

function deriveDisplayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  return localPart
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function isLegacyStringArray(attendees: unknown): attendees is string[] {
  if (!Array.isArray(attendees)) return false;
  if (attendees.length === 0) return false;
  return typeof attendees[0] === 'string';
}

function isAlreadyConverted(attendees: unknown): attendees is AttendeePresent[] {
  if (!Array.isArray(attendees)) return false;
  if (attendees.length === 0) return true;
  return typeof attendees[0] === 'object' && attendees[0] !== null && 'name' in attendees[0];
}

async function backfillAttendees(dryRun: boolean = false): Promise<void> {
  console.log('='.repeat(60));
  console.log('Attendee Data Backfill Script');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('='.repeat(60));
  console.log('');

  const allMinutes = await db
    .select({
      id: meetingMinutes.id,
      meetingId: meetingMinutes.meetingId,
      attendeesPresent: meetingMinutes.attendeesPresent,
    })
    .from(meetingMinutes)
    .where(isNotNull(meetingMinutes.attendeesPresent));

  console.log(`Found ${allMinutes.length} meeting minutes records to check`);
  console.log('');

  let convertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const minutes of allMinutes) {
    const attendees = minutes.attendeesPresent;
    
    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
      console.log(`  [SKIP] ${minutes.id}: Empty or null attendees`);
      skippedCount++;
      continue;
    }

    if (isAlreadyConverted(attendees)) {
      console.log(`  [SKIP] ${minutes.id}: Already in object format`);
      skippedCount++;
      continue;
    }

    if (!isLegacyStringArray(attendees)) {
      console.log(`  [ERROR] ${minutes.id}: Unknown format: ${JSON.stringify(attendees)}`);
      errorCount++;
      continue;
    }

    const stringAttendees = attendees as string[];

    const meeting = await db
      .select({
        attendees: meetings.attendees,
        organizerEmail: meetings.organizerEmail,
      })
      .from(meetings)
      .where(eq(meetings.id, minutes.meetingId))
      .limit(1);

    const meetingAttendees = meeting[0]?.attendees as string[] | undefined;
    
    const convertedAttendees: AttendeePresent[] = stringAttendees.map((attendee: string) => {
      const trimmed = attendee.trim();
      const isEmail = trimmed.includes('@');
      
      if (isEmail) {
        return {
          name: deriveDisplayNameFromEmail(trimmed),
          email: trimmed.toLowerCase(),
        };
      } else {
        return {
          name: trimmed,
          email: '',
        };
      }
    });

    console.log(`  [CONVERT] ${minutes.id}:`);
    console.log(`    Before: ${JSON.stringify(attendees)}`);
    console.log(`    After:  ${JSON.stringify(convertedAttendees)}`);

    if (!dryRun) {
      try {
        await db
          .update(meetingMinutes)
          .set({ attendeesPresent: convertedAttendees })
          .where(eq(meetingMinutes.id, minutes.id));
        convertedCount++;
      } catch (error) {
        console.log(`    [ERROR] Failed to update: ${error}`);
        errorCount++;
      }
    } else {
      convertedCount++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Converted: ${convertedCount}`);
  console.log(`  Skipped:   ${skippedCount}`);
  console.log(`  Errors:    ${errorCount}`);
  console.log('='.repeat(60));

  if (dryRun && convertedCount > 0) {
    console.log('');
    console.log('This was a dry run. Run without --dry-run to apply changes.');
  }
}

const isDryRun = process.argv.includes('--dry-run');
backfillAttendees(isDryRun)
  .then(() => {
    console.log('');
    console.log('Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
