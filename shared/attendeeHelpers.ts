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

/**
 * Extract speaker names from WebVTT transcript
 * Parses <v Speaker Name>text</v> patterns to get actual display names
 */
export function extractSpeakersFromTranscript(transcript: string): string[] {
  const speakerPattern = /<v\s+([^>]+)>/g;
  const speakers = new Set<string>();
  let match;
  
  while ((match = speakerPattern.exec(transcript)) !== null) {
    const speakerName = match[1].trim();
    if (speakerName && speakerName.length > 1) {
      speakers.add(speakerName);
    }
  }
  
  const result: string[] = [];
  speakers.forEach(s => result.push(s));
  return result;
}

/**
 * Identity Profile - enriched attendee data with aliases for better matching
 */
export interface IdentityProfile {
  canonicalName: string;  // Best full name we can determine
  email: string;
  aliases: string[];      // All possible name variations
  tokens: string[];       // Name tokens for fuzzy matching
}

/**
 * Extract name hints from email address
 * thomas@dulaney.net → ["Thomas", "Dulaney", "Thomas Dulaney"]
 * john.doe@company.com → ["John", "Doe", "John Doe"]
 * mairajali75@hotmail.com → ["Mairaj", "Ali", "Mairaj Ali"] (splits camelCase, removes numbers)
 */
export function extractNamesFromEmail(email: string): string[] {
  if (!email || !email.includes('@')) return [];
  
  const [localPart, domain] = email.split('@');
  const names: string[] = [];
  
  // Process local part: split on dots, underscores, and camelCase
  const localNames = localPart
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // Split camelCase
    .replace(/[._]/g, ' ')                  // Split on dots and underscores
    .replace(/[0-9]/g, '')                  // Remove numbers
    .split(/\s+/)
    .filter(w => w.length > 1)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  
  names.push(...localNames);
  
  // Check if domain looks like a personal name (not a company)
  // e.g., dulaney.net, smith.org - single word before TLD
  const domainParts = domain.split('.');
  if (domainParts.length >= 2) {
    const possibleName = domainParts[0];
    const tld = domainParts[domainParts.length - 1];
    // If domain is short and TLD is common personal domain TLDs
    if (possibleName.length > 2 && 
        possibleName.length < 15 && 
        ['net', 'org', 'com', 'me', 'io', 'co'].includes(tld) &&
        !['gmail', 'yahoo', 'hotmail', 'outlook', 'live', 'icloud', 'aol', 'msn', 'ibm', 'microsoft', 'google', 'apple', 'amazon'].includes(possibleName.toLowerCase())) {
      const domainName = possibleName.charAt(0).toUpperCase() + possibleName.slice(1).toLowerCase();
      // Add domain name as a potential surname if not already in localNames
      if (!localNames.some(n => n.toLowerCase() === domainName.toLowerCase())) {
        names.push(domainName);
      }
    }
  }
  
  // If we have at least 2 name parts, create a combined full name
  if (names.length >= 2) {
    // Create full name from unique parts
    const seenLower = new Set<string>();
    const uniqueNames: string[] = [];
    for (const n of names) {
      const lower = n.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        uniqueNames.push(n.charAt(0).toUpperCase() + n.slice(1).toLowerCase());
      }
    }
    if (uniqueNames.length >= 2) {
      names.push(uniqueNames.join(' '));
    }
  }
  
  // Deduplicate
  const seen = new Set<string>();
  const result: string[] = [];
  for (const n of names) {
    if (!seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  }
  return result;
}

/**
 * Build enriched identity profiles from attendee data
 * Combines name field, email parsing, and generates aliases
 */
export function buildIdentityProfiles(attendees: AttendeePresent[]): IdentityProfile[] {
  return attendees.map(attendee => {
    const aliases: string[] = [];
    const tokens: string[] = [];
    
    // Start with the provided name
    if (attendee.name) {
      aliases.push(attendee.name);
      
      // Split name into tokens (handle camelCase like "Christopherbecraft")
      const nameTokens = attendee.name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1);
      tokens.push(...nameTokens);
      
      // Add individual tokens as aliases (first name, last name separately)
      nameTokens.forEach(t => {
        const capitalized = t.charAt(0).toUpperCase() + t.slice(1);
        if (!aliases.some(a => a.toLowerCase() === capitalized.toLowerCase())) {
          aliases.push(capitalized);
        }
      });
    }
    
    // Extract names from email
    if (attendee.email) {
      const emailNames = extractNamesFromEmail(attendee.email);
      emailNames.forEach(name => {
        if (!aliases.some(a => a.toLowerCase() === name.toLowerCase())) {
          aliases.push(name);
        }
        // Add tokens
        const emailTokens = name.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        emailTokens.forEach(t => {
          if (!tokens.includes(t)) tokens.push(t);
        });
      });
    }
    
    // Determine canonical name: prefer longest alias that looks like a full name
    const fullNameCandidates = aliases
      .filter(a => a.includes(' '))
      .sort((a, b) => b.length - a.length);
    
    const canonicalName = fullNameCandidates[0] || attendee.name || aliases[0] || 'Unknown';
    
    return {
      canonicalName,
      email: attendee.email,
      aliases,
      tokens
    };
  });
}

/**
 * Find best matching identity profile for an assignee name
 * Returns the matched profile or null if no good match found
 */
export function findMatchingIdentity(
  assignee: string, 
  profiles: IdentityProfile[]
): IdentityProfile | null {
  if (!assignee || assignee.toLowerCase() === 'unassigned') return null;
  
  const assigneeLower = assignee.toLowerCase();
  const assigneeNormalized = assigneeLower.replace(/[^a-z]/g, '');
  const assigneeTokens = assignee
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
  
  let bestMatch: { profile: IdentityProfile; score: number } | null = null;
  
  for (const profile of profiles) {
    let score = 0;
    
    // Check exact alias match
    if (profile.aliases.some(a => a.toLowerCase() === assigneeLower)) {
      score = 100;
    }
    
    // Check normalized match (removes spaces/numbers)
    if (score < 100) {
      for (const alias of profile.aliases) {
        const aliasNormalized = alias.toLowerCase().replace(/[^a-z]/g, '');
        if (aliasNormalized === assigneeNormalized) {
          score = Math.max(score, 95);
        }
        if (aliasNormalized.includes(assigneeNormalized) && assigneeNormalized.length >= 4) {
          score = Math.max(score, 88);
        }
        if (assigneeNormalized.includes(aliasNormalized) && aliasNormalized.length >= 4) {
          score = Math.max(score, 85);
        }
      }
    }
    
    // Check token overlap
    if (score < 85) {
      const commonTokens = assigneeTokens.filter(t => profile.tokens.includes(t));
      if (commonTokens.length > 0) {
        // First token match (usually first name)
        if (assigneeTokens[0] && profile.tokens.includes(assigneeTokens[0])) {
          score = Math.max(score, 70 + commonTokens.length * 5);
        }
        // Last token match (usually last name)
        else if (assigneeTokens.length > 0 && profile.tokens.includes(assigneeTokens[assigneeTokens.length - 1])) {
          score = Math.max(score, 65 + commonTokens.length * 5);
        }
        // Any token match
        else {
          score = Math.max(score, 50 + commonTokens.length * 10);
        }
      }
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { profile, score };
    }
  }
  
  // Only return match if score is high enough
  return bestMatch && bestMatch.score >= 50 ? bestMatch.profile : null;
}
