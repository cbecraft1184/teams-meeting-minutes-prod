# Configuration Guide
## DOD Teams Meeting Minutes Management System

### Environment Variables

The application uses environment variables for configuration. These should be stored securely in AWS Secrets Manager and loaded at runtime.

#### Required Variables

```bash
# Microsoft Identity Platform
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
MICROSOFT_CLIENT_SECRET=your-secret-value

# Azure OpenAI Service (Gov Cloud)
AZURE_OPENAI_ENDPOINT=https://your-service.openai.azure.us/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4-teams-minutes
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# SharePoint Configuration
SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.us/sites/MeetingMinutes
SHAREPOINT_LIBRARY_NAME=Meeting Minutes

# Database Configuration
DATABASE_HOST=dod-teams-db.xxxxx.rds.amazonaws-us-gov.com
DATABASE_PORT=5432
DATABASE_NAME=teamsminutes
DATABASE_USER=dbadmin
DATABASE_PASSWORD=your-secure-password
DATABASE_SSL=true

# Application Configuration
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-long-random-secret-minimum-32-characters

# Webhook Configuration
TEAMS_WEBHOOK_CLIENT_STATE=your-validation-secret
TEAMS_WEBHOOK_URL=https://your-domain.gov/api/webhooks/teams

# Application URL
APP_URL=https://your-domain.gov

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

#### Optional Variables

```bash
# Redis Configuration (for session storage in multi-instance setup)
REDIS_URL=redis://your-redis-cluster:6379
REDIS_PASSWORD=your-redis-password

# S3 Bucket for temporary document storage
S3_BUCKET_NAME=dod-teams-minutes-documents
S3_REGION=us-gov-west-1

# Email Notifications (via SES)
EMAIL_FROM=noreply@your-domain.gov
EMAIL_ADMIN=admin@your-domain.gov
SES_REGION=us-gov-west-1

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# Processing Timeouts
AI_PROCESSING_TIMEOUT_MS=300000
SHAREPOINT_UPLOAD_TIMEOUT_MS=60000

# Feature Flags
ENABLE_AUTO_PROCESSING=true
ENABLE_AUTO_ARCHIVAL=true
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_ACTION_ITEM_EXTRACTION=true

# Monitoring
CLOUDWATCH_LOG_GROUP=/aws/dod-teams-minutes
CLOUDWATCH_LOG_STREAM=application
```

### Azure OpenAI Configuration

#### Supported Models
- **gpt-4**: Most accurate, best for complex meeting analysis
- **gpt-4-32k**: Extended context for very long meetings (>2 hours)
- **gpt-4-turbo**: Faster processing, good for most meetings

#### Recommended Deployment Settings
```json
{
  "deployment_name": "gpt-4-teams-minutes",
  "model": "gpt-4",
  "version": "0613",
  "scale_settings": {
    "scale_type": "Standard",
    "capacity": 120
  },
  "tokens_per_minute_limit": 120000
}
```

#### Prompt Configuration

The application uses these system prompts (customizable in config):

**Meeting Summary Prompt**
```
You are an AI assistant helping to generate meeting minutes for DOD meetings. 
Analyze the provided meeting transcript and generate a concise, professional summary.

Requirements:
- Use formal, government-appropriate language
- Focus on key decisions and action items
- Maintain security classification awareness
- Structure output as JSON with these fields: summary, keyDiscussions, decisions
- Extract action items with assignees when mentioned

Output JSON format:
{
  "summary": "Brief overall summary",
  "keyDiscussions": ["Discussion point 1", "Discussion point 2"],
  "decisions": ["Decision 1", "Decision 2"]
}
```

**Action Item Extraction Prompt**
```
Extract action items from this meeting transcript. For each action item, identify:
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
]
```

### Microsoft Teams Configuration

#### Webhook Subscription Settings

```json
{
  "changeType": "created,updated",
  "notificationUrl": "https://your-domain.gov/api/webhooks/teams",
  "resource": "/communications/onlineMeetings",
  "expirationDateTime": "2025-12-31T23:59:59Z",
  "clientState": "your-validation-secret",
  "includeResourceData": false,
  "lifecycleNotificationUrl": "https://your-domain.gov/api/webhooks/teams/lifecycle"
}
```

#### Supported Meeting Events
- `created`: When a new meeting is scheduled
- `updated`: When meeting details change
- `deleted`: When a meeting is cancelled
- Meeting recordings available
- Meeting transcripts available

#### Graph API Scopes Required
```
OnlineMeetings.Read.All
OnlineMeetingRecording.Read.All
OnlineMeetingTranscript.Read.All
Calendars.Read
User.Read.All
Sites.Selected
```

### SharePoint Configuration

#### Document Library Schema

```xml
<Field DisplayName="Classification" 
       InternalName="Classification" 
       Type="Choice" 
       Required="TRUE">
  <CHOICES>
    <CHOICE>UNCLASSIFIED</CHOICE>
    <CHOICE>CONFIDENTIAL</CHOICE>
    <CHOICE>SECRET</CHOICE>
  </CHOICES>
  <Default>UNCLASSIFIED</Default>
</Field>

<Field DisplayName="Meeting Date" 
       InternalName="MeetingDate" 
       Type="DateTime" 
       Format="DateOnly"
       Required="TRUE" />

<Field DisplayName="Attendee Count" 
       InternalName="AttendeeCount" 
       Type="Number" 
       Min="1" />

<Field DisplayName="Duration" 
       InternalName="Duration" 
       Type="Text" />

<Field DisplayName="Meeting ID" 
       InternalName="MeetingID" 
       Type="Text" 
       Indexed="TRUE" />
```

#### Folder Structure
```
Meeting Minutes/
├── 2025/
│   ├── 01-January/
│   │   ├── UNCLASSIFIED/
│   │   ├── CONFIDENTIAL/
│   │   └── SECRET/
│   ├── 02-February/
│   └── ...
├── 2024/
└── Archives/
```

#### Permissions Model
```
Site Owners: Full Control
- IT Administrators
- Security Officers

Site Members: Contribute
- Meeting organizers
- Designated minute takers

Site Visitors: Read
- Meeting attendees
- Authorized personnel

Classification-based:
- UNCLASSIFIED: All authenticated users
- CONFIDENTIAL: Confidential+ clearance group
- SECRET: Secret clearance group
```

### Database Configuration

#### Connection Pool Settings
```javascript
{
  max: 20,              // Maximum connections
  min: 5,               // Minimum connections
  idle: 10000,          // Idle timeout (ms)
  acquire: 30000,       // Acquire timeout (ms)
  evict: 1000,          // Eviction interval (ms)
  ssl: {
    require: true,
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/rds-ca-cert.pem')
  }
}
```

#### Backup Schedule
```bash
# Automated backups via RDS
Backup window: 03:00-04:00 UTC
Retention period: 30 days
Enable automated backups: true
Enable Multi-AZ: true
Enable deletion protection: true
```

#### Maintenance Window
```bash
Preferred maintenance window: Sun:04:00-Sun:05:00 UTC
Auto minor version upgrade: true
```

### Security Configuration

#### Session Management
```javascript
{
  secret: process.env.SESSION_SECRET,
  name: 'dod.teams.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,          // HTTPS only
    httpOnly: true,        // No JS access
    maxAge: 3600000,       // 1 hour
    sameSite: 'strict',    // CSRF protection
    domain: '.your-domain.gov'
  },
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:',
    ttl: 3600
  })
}
```

#### CORS Configuration
```javascript
{
  origin: [
    'https://your-domain.gov',
    'https://teams.microsoft.com',
    'https://teams.microsoft.us'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400
}
```

#### Rate Limiting
```javascript
{
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.'
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
}
```

### Logging Configuration

#### Log Levels
- **error**: Critical errors requiring immediate attention
- **warn**: Warning conditions that should be reviewed
- **info**: General informational messages (default)
- **debug**: Detailed debugging information
- **trace**: Very detailed trace information

#### Log Format (JSON)
```json
{
  "timestamp": "2025-10-30T14:23:45.123Z",
  "level": "info",
  "service": "teams-minutes",
  "environment": "production",
  "message": "Meeting processed successfully",
  "meetingId": "abc123",
  "duration": 1234,
  "userId": "user@dod.gov",
  "traceId": "xyz789"
}
```

#### CloudWatch Integration
```javascript
{
  logGroupName: '/aws/dod-teams-minutes',
  logStreamName: `application-${process.env.HOSTNAME}`,
  uploadRate: 2000,        // ms between uploads
  logEvents: 10,           // batch size
  errorHandler: (error) => {
    console.error('CloudWatch error:', error);
  }
}
```

### Monitoring & Alerting

#### CloudWatch Metrics
```
Custom Metrics:
- meetings.processed (count)
- meetings.failed (count)
- ai.processing.duration (milliseconds)
- sharepoint.upload.duration (milliseconds)
- api.response.time (milliseconds)

Standard Metrics:
- CPU utilization
- Memory utilization
- Network in/out
- Disk read/write
- Database connections
```

#### Alert Thresholds
```yaml
high_error_rate:
  metric: errors
  threshold: 50
  period: 300
  evaluation_periods: 2
  comparison: GreaterThanThreshold
  
high_latency:
  metric: api.response.time
  threshold: 2000  # 2 seconds
  period: 300
  evaluation_periods: 3
  comparison: GreaterThanThreshold
  
database_connections:
  metric: DatabaseConnections
  threshold: 80
  period: 300
  evaluation_periods: 2
  comparison: GreaterThanThreshold

processing_failures:
  metric: meetings.failed
  threshold: 5
  period: 900  # 15 minutes
  evaluation_periods: 1
  comparison: GreaterThanThreshold
```

### Classification Configuration

#### Default Classification Levels
```javascript
const CLASSIFICATION_LEVELS = {
  UNCLASSIFIED: {
    color: 'green',
    markings: 'UNCLASSIFIED',
    sharePointGroup: 'All Users',
    retention: 7  // years
  },
  CONFIDENTIAL: {
    color: 'blue',
    markings: 'CONFIDENTIAL',
    sharePointGroup: 'Confidential Clearance',
    retention: 10
  },
  SECRET: {
    color: 'red',
    markings: 'SECRET',
    sharePointGroup: 'Secret Clearance',
    retention: 15
  }
};
```

#### Document Marking Template
```
Header: [CLASSIFICATION] - DOD Meeting Minutes
Footer: [CLASSIFICATION] - Page X of Y - Generated: [DATE]

Example:
UNCLASSIFIED - DOD Meeting Minutes
Meeting Title: Weekly Status Review
Date: October 30, 2025
Duration: 1 hour 15 minutes

[Content...]

UNCLASSIFIED - Page 1 of 3 - Generated: 2025-10-30 14:45 UTC
```

### Backup & Recovery Configuration

#### Backup Strategy
```yaml
database:
  automated_snapshots:
    enabled: true
    retention: 30  # days
    window: "03:00-04:00 UTC"
  
  manual_snapshots:
    retention: 365  # days
    tags:
      - Environment: Production
      - Application: Teams-Minutes

documents:
  s3_versioning: enabled
  lifecycle_policy:
    - transition_to_glacier: 90  # days
    - delete_old_versions: 365  # days
  
  cross_region_replication:
    enabled: true
    destination: us-gov-east-1
```

#### Recovery Procedures
```bash
# Database point-in-time recovery
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier dod-teams-db \
  --target-db-instance-identifier dod-teams-db-restored \
  --restore-time 2025-10-30T12:00:00Z

# S3 document recovery
aws s3api restore-object \
  --bucket dod-teams-documents \
  --key meeting-minutes/2025/document.pdf \
  --restore-request Days=7,GlacierJobParameters={Tier=Expedited}
```

### Performance Tuning

#### Application Settings
```javascript
{
  clustering: {
    enabled: true,
    workers: 'auto',  // CPU count
    restart_delay: 1000
  },
  
  compression: {
    enabled: true,
    level: 6,
    threshold: 1024  // bytes
  },
  
  caching: {
    static_files: 31536000,  // 1 year
    api_responses: 300,       // 5 minutes
    database_queries: 60      // 1 minute
  }
}
```

#### Database Query Optimization
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM meetings 
WHERE status = 'completed' 
AND scheduled_at > NOW() - INTERVAL '30 days';

-- Create appropriate indexes
CREATE INDEX CONCURRENTLY idx_meetings_status_date 
ON meetings(status, scheduled_at DESC);

-- Update statistics
ANALYZE meetings;
ANALYZE meeting_minutes;
ANALYZE action_items;
```

---

**Document Classification**: UNCLASSIFIED  
**Last Updated**: October 30, 2025  
**Version**: 1.0
