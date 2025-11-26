# Future Feature: Meeting Opt-In/Opt-Out Mechanism

**Status:** NOT IMPLEMENTED - Documentation Only  
**Priority:** Phase 3 Enhancement  
**Estimated Effort:** 4-6 hours development

---

## Business Requirement

Users scheduling Teams meetings should have explicit choice to enable/disable AI-powered meeting minutes processing. The application must ONLY process meetings that users explicitly opt into.

---

## Architect-Recommended Design

### Primary Method: Teams Meeting Extension
When a user schedules a Teams meeting and adds the "Meeting Minutes" app, a configuration page appears where they can opt-in and configure processing.

### Secondary Method: Dashboard User Preference
Users can set a global default preference: "Always process my meetings" which serves as a fallback when no meeting-specific opt-in exists.

---

## Implementation Checklist

### Phase 1: Database Schema

**New Table: `meeting_opt_ins`**

```typescript
// Add to shared/schema.ts

export const meetingOptIns = pgTable('meeting_opt_ins', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  onlineMeetingId: text('online_meeting_id').notNull().unique(),
  organizerAadId: text('organizer_aad_id').notNull(),
  meetingStart: timestamp('meeting_start').notNull(),
  isOptedIn: boolean('is_opted_in').notNull().default(false),
  templateId: varchar('template_id').references(() => meetingTemplates.id),
  recurrenceId: text('recurrence_id'),
  seriesMasterId: text('series_master_id'),
  auditLog: jsonb('audit_log'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Zod schemas
export const insertMeetingOptInSchema = createInsertSchema(meetingOptIns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMeetingOptIn = z.infer<typeof insertMeetingOptInSchema>;
export type MeetingOptIn = typeof meetingOptIns.$inferSelect;
```

**User Preference Addition:**

```typescript
// Add to users table in shared/schema.ts
export const users = pgTable('users', {
  // ... existing fields ...
  autoProcessMeetings: boolean('auto_process_meetings').default(false),
});
```

**Migration:**
```bash
npm run db:push
```

---

### Phase 2: Storage Interface

**Update `server/storage.ts`:**

```typescript
interface IStorage {
  // ... existing methods ...
  
  // Meeting opt-in methods
  createMeetingOptIn(data: InsertMeetingOptIn): Promise<MeetingOptIn>;
  getMeetingOptIn(onlineMeetingId: string): Promise<MeetingOptIn | null>;
  updateMeetingOptIn(onlineMeetingId: string, updates: Partial<InsertMeetingOptIn>): Promise<MeetingOptIn>;
  deleteMeetingOptIn(onlineMeetingId: string): Promise<void>;
  
  // User preference methods
  getUserAutoProcessPreference(azureAdId: string): Promise<boolean>;
  setUserAutoProcessPreference(azureAdId: string, autoProcess: boolean): Promise<void>;
}
```

**Implementation in `DbStorage` class:**

```typescript
async createMeetingOptIn(data: InsertMeetingOptIn): Promise<MeetingOptIn> {
  const [result] = await this.db.insert(meetingOptIns).values(data).returning();
  return result;
}

async getMeetingOptIn(onlineMeetingId: string): Promise<MeetingOptIn | null> {
  const [result] = await this.db
    .select()
    .from(meetingOptIns)
    .where(eq(meetingOptIns.onlineMeetingId, onlineMeetingId));
  return result || null;
}

async getUserAutoProcessPreference(azureAdId: string): Promise<boolean> {
  const [user] = await this.db
    .select({ autoProcess: users.autoProcessMeetings })
    .from(users)
    .where(eq(users.azureAdId, azureAdId));
  return user?.autoProcess ?? false;
}
```

---

### Phase 3: API Routes

**Add to `server/routes.ts`:**

```typescript
// Meeting opt-in endpoints
app.post('/api/meetings/:meetingId/opt-in', requireAuth, async (req, res) => {
  const { meetingId } = req.params;
  const { templateId, applyToSeries } = req.body;
  
  const optIn = await storage.createMeetingOptIn({
    onlineMeetingId: meetingId,
    organizerAadId: req.user!.azureAdId,
    meetingStart: new Date(), // Get from meeting data
    isOptedIn: true,
    templateId,
    seriesMasterId: applyToSeries ? meetingId : null,
  });
  
  res.json(optIn);
});

app.get('/api/meetings/:meetingId/opt-in', requireAuth, async (req, res) => {
  const { meetingId } = req.params;
  const optIn = await storage.getMeetingOptIn(meetingId);
  res.json(optIn || { isOptedIn: false });
});

app.put('/api/meetings/:meetingId/opt-in', requireAuth, async (req, res) => {
  const { meetingId } = req.params;
  const { isOptedIn, templateId } = req.body;
  
  const updated = await storage.updateMeetingOptIn(meetingId, {
    isOptedIn,
    templateId,
  });
  
  res.json(updated);
});

// User preference endpoints
app.get('/api/user/preferences', requireAuth, async (req, res) => {
  const autoProcess = await storage.getUserAutoProcessPreference(req.user!.azureAdId);
  res.json({ autoProcessMeetings: autoProcess });
});

app.put('/api/user/preferences', requireAuth, async (req, res) => {
  const { autoProcessMeetings } = req.body;
  await storage.setUserAutoProcessPreference(req.user!.azureAdId, autoProcessMeetings);
  res.json({ success: true });
});
```

---

### Phase 4: Teams Manifest Updates

**Update `teams-app/manifest.json`:**

```json
{
  "configurableTabs": [
    {
      "configurationUrl": "https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/meeting-config",
      "canUpdateConfiguration": true,
      "scopes": ["groupchat"],
      "context": ["meetingChatTab", "meetingDetailsTab", "meetingSidePanel"],
      "sharePointPreviewImage": "https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/preview.png",
      "supportedSharePointHosts": ["sharePointFullPage", "sharePointWebPart"]
    }
  ],
  "validDomains": [
    "teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io",
    "token.botframework.com"
  ]
}
```

---

### Phase 5: Meeting Configuration UI

**New Component: `client/src/pages/meeting-config.tsx`**

```typescript
import { useEffect, useState } from 'react';
import * as microsoftTeams from "@microsoft/teams-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const configSchema = z.object({
  enableMinutes: z.boolean(),
  templateId: z.string().optional(),
  applyToSeries: z.boolean().default(false),
});

type ConfigForm = z.infer<typeof configSchema>;

export default function MeetingConfig() {
  const [context, setContext] = useState<microsoftTeams.app.Context | null>(null);
  
  const form = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      enableMinutes: true,
      applyToSeries: false,
    },
  });

  useEffect(() => {
    microsoftTeams.app.initialize().then(() => {
      microsoftTeams.app.getContext().then(setContext);
      
      // Enable save button
      microsoftTeams.pages.config.registerOnSaveHandler((saveEvent) => {
        const values = form.getValues();
        
        // Save opt-in to database
        fetch(`/api/meetings/${context?.meeting?.id}/opt-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isOptedIn: values.enableMinutes,
            templateId: values.templateId,
            applyToSeries: values.applyToSeries,
          }),
        }).then(() => {
          saveEvent.notifySuccess();
        });
      });
      
      // Set valid configuration
      microsoftTeams.pages.config.setValidityState(true);
    });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Meeting Minutes Configuration</h1>
      
      <form className="space-y-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="enableMinutes"
            {...form.register('enableMinutes')}
          />
          <label htmlFor="enableMinutes">
            Enable AI-powered meeting minutes for this meeting
          </label>
        </div>
        
        {form.watch('enableMinutes') && (
          <>
            <div>
              <label>Template (optional):</label>
              <select {...form.register('templateId')}>
                <option value="">Default</option>
                <option value="briefing">Briefing</option>
                <option value="planning">Planning</option>
                <option value="status_review">Status Review</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="applyToSeries"
                {...form.register('applyToSeries')}
              />
              <label htmlFor="applyToSeries">
                Apply to all instances (recurring meeting)
              </label>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
```

**Add route to `client/src/App.tsx`:**

```typescript
<Route path="/meeting-config" component={MeetingConfig} />
```

---

### Phase 6: Webhook Filtering Logic

**Update `server/services/graphWebhooks.ts`:**

```typescript
async function handleMeetingEvent(notification: GraphNotification) {
  const meetingId = notification.resourceData.id;
  
  // Check opt-in registry
  const optIn = await storage.getMeetingOptIn(meetingId);
  
  if (optIn?.isOptedIn) {
    // User explicitly opted in - process meeting
    await processMeetingEvent(notification);
    return;
  }
  
  // No opt-in record - check user default preference
  const organizerId = notification.resourceData.organizer?.user?.id;
  if (organizerId) {
    const autoProcess = await storage.getUserAutoProcessPreference(organizerId);
    
    if (autoProcess) {
      // User has global auto-process enabled
      await processMeetingEvent(notification);
      return;
    }
  }
  
  // Not opted in - ignore this meeting
  console.log(`[Webhook] Skipping meeting ${meetingId} - not opted in`);
}
```

---

### Phase 7: Dashboard User Settings

**New Component: `client/src/components/settings-panel.tsx`**

```typescript
export function SettingsPanel() {
  const { data: preferences } = useQuery({
    queryKey: ['/api/user/preferences'],
  });
  
  const updateMutation = useMutation({
    mutationFn: async (autoProcess: boolean) => {
      return apiRequest('/api/user/preferences', {
        method: 'PUT',
        body: { autoProcessMeetings: autoProcess },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
    },
  });
  
  return (
    <div className="space-y-4">
      <h2>Meeting Processing Preferences</h2>
      
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={preferences?.autoProcessMeetings ?? false}
          onChange={(e) => updateMutation.mutate(e.target.checked)}
        />
        <label>
          Automatically process all my meetings (can override per-meeting)
        </label>
      </div>
    </div>
  );
}
```

---

## Migration Plan

### Step 1: Deploy Schema Changes
```bash
npm run db:push
```

### Step 2: Backfill Existing Meetings
```sql
-- Mark all existing meetings as opted-out (safe default)
INSERT INTO meeting_opt_ins (online_meeting_id, organizer_aad_id, meeting_start, is_opted_in)
SELECT 
  online_meeting_id, 
  organizer_aad_id, 
  scheduled_at,
  false
FROM meetings
WHERE online_meeting_id IS NOT NULL
ON CONFLICT (online_meeting_id) DO NOTHING;
```

### Step 3: Deploy Code Changes
- Update storage interface
- Add API routes
- Deploy meeting config UI
- Update webhook logic

### Step 4: Update Teams Manifest
- Add `configurableTabs` configuration
- Increment version to 1.1.0
- Re-package and upload to Teams Admin Center

### Step 5: Enable Filtering
- Deploy webhook filtering logic
- Monitor logs for opt-in checks
- Verify meetings without opt-in are skipped

### Step 6: User Communication
- Notify users of new opt-in feature
- Provide instructions for adding app to meetings
- Document how to set global preferences

---

## Testing Checklist

- [ ] User can add app to meeting during scheduling
- [ ] Configuration page loads in Teams
- [ ] Opt-in choice saves to database
- [ ] Webhook skips meetings without opt-in
- [ ] Webhook processes meetings with opt-in
- [ ] User can set global auto-process preference
- [ ] Global preference works as fallback
- [ ] Recurring meetings apply opt-in to all instances
- [ ] Audit log tracks all consent changes
- [ ] User can view/revoke consent in dashboard

---

## Security Considerations

- All API endpoints require authentication
- Only meeting organizer can set opt-in preference
- Audit trail logs all consent decisions
- Users can revoke consent at any time
- No meeting processing without explicit or default consent

---

## Recurring Meeting Handling

When user opts-in to a recurring meeting:

1. **Single Instance:** Store only that meeting's `online_meeting_id`
2. **All Instances:** Store `series_master_id` and link all occurrences
3. **Override:** Individual instances can override series default

**Database Query:**
```typescript
// Check if meeting or its series is opted-in
const optIn = await db
  .select()
  .from(meetingOptIns)
  .where(
    or(
      eq(meetingOptIns.onlineMeetingId, meetingId),
      eq(meetingOptIns.seriesMasterId, seriesMasterId)
    )
  )
  .orderBy(desc(meetingOptIns.createdAt))
  .limit(1);
```

---

## Future Enhancements

- **Template Library:** Pre-configured minute templates by meeting type
- **Delegation:** Allow assistants to manage organizer's opt-ins
- **Bulk Operations:** Opt-in multiple meetings at once
- **Smart Defaults:** AI suggests opt-in based on meeting patterns
- **Analytics:** Show user how many meetings processed/saved

---

## Support & Troubleshooting

**Issue: Configuration page doesn't load**
- Verify `configurableTabs` in manifest is correct
- Check Teams app version is deployed
- Verify endpoint URL is accessible

**Issue: Meetings still processing without opt-in**
- Check webhook filtering logic is deployed
- Verify database has opt-in records
- Review logs for filtering decisions

**Issue: Global preference not working**
- Verify users table has `auto_process_meetings` column
- Check API endpoint returns preference correctly
- Ensure webhook checks user preference as fallback

---

**End of Documentation**
