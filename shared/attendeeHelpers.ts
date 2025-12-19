import type { AttendeePresent, AttendeePresentInput } from './schema';

export type { AttendeePresent, AttendeePresentInput };

/**
 * Convert email to display name
 * john.doe@company.com -> John Doe
 */
export function emailToDisplayName(email: string): string {
  const namePart = email.split('@')[0];
  return namePart
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

/**
 * Normalize any attendee input to AttendeePresent object
 * Handles: plain emails, display names, Graph API objects, legacy strings
 */
export function normalizeToAttendeeObject(input: any): AttendeePresent | null {
  if (!input) return null;
  
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    
    if (trimmed.includes('@')) {
      return {
        name: emailToDisplayName(trimmed),
        email: trimmed.toLowerCase()
      };
    }
    return {
      name: trimmed,
      email: '' 
    };
  }
  
  if (typeof input === 'object') {
    if ('name' in input && 'email' in input) {
      return {
        name: String(input.name || '').trim(),
        email: String(input.email || '').trim().toLowerCase()
      };
    }
    
    const displayName = input.displayName?.trim() || 
                       input.name?.trim() || 
                       input.emailAddress?.name?.trim() ||
                       input.identity?.user?.displayName?.trim();
    
    const email = input.email?.trim() || 
                 input.emailAddress?.address?.trim() ||
                 input.identity?.user?.email?.trim();
    
    if (displayName || email) {
      return {
        name: displayName || (email ? emailToDisplayName(email) : ''),
        email: (email || '').toLowerCase()
      };
    }
  }
  
  return null;
}

/**
 * Normalize array of mixed attendee inputs to AttendeePresent objects
 */
export function normalizeAttendeesArray(inputs: any[]): AttendeePresent[] {
  return inputs
    .map(normalizeToAttendeeObject)
    .filter((a): a is AttendeePresent => a !== null && (a.name.length > 0 || a.email.length > 0));
}

/**
 * Get display name from attendee object
 */
export function getAttendeeDisplayName(attendee: AttendeePresentInput): string {
  return attendee.name || attendee.email || 'Unknown';
}

/**
 * Get email from attendee object
 */
export function getAttendeeEmail(attendee: AttendeePresentInput): string {
  return attendee.email || '';
}

/**
 * Build lookup maps from attendee array for matching
 * Returns: { emailToName, nameToEmail, allIdentifiers }
 */
export function buildAttendeeLookups(attendees: AttendeePresent[]): {
  emailToName: Map<string, string>;
  nameToEmail: Map<string, string>;
  allIdentifiers: Set<string>;
} {
  const emailToName = new Map<string, string>();
  const nameToEmail = new Map<string, string>();
  const allIdentifiers = new Set<string>();
  
  for (const attendee of attendees) {
    if (attendee.email) {
      emailToName.set(attendee.email.toLowerCase(), attendee.name);
      allIdentifiers.add(attendee.email.toLowerCase());
    }
    if (attendee.name) {
      nameToEmail.set(attendee.name.toLowerCase(), attendee.email);
      allIdentifiers.add(attendee.name.toLowerCase());
    }
  }
  
  return { emailToName, nameToEmail, allIdentifiers };
}

/**
 * Get display names from attendeesPresent array (handles both legacy string[] and new object[] formats)
 * Use this for UI display to ensure backward compatibility
 */
export function getAttendeesDisplayNames(attendeesPresent: AttendeePresentInput[]): string[] {
  return attendeesPresent.map(getAttendeeDisplayName);
}

/**
 * Get attendee count from attendeesPresent array (handles both formats)
 */
export function getAttendeesCount(attendeesPresent: AttendeePresentInput[]): number {
  return attendeesPresent?.length || 0;
}
