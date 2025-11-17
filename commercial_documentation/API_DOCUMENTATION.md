# API Documentation
## Enterprise Meeting Minutes Platform

### Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:5000/api
```

### Authentication
All API endpoints (except `/health` and webhooks) require authentication via Microsoft Identity Platform JWT tokens.

**Authentication Flow:**
1. User authenticates via Azure AD OAuth 2.0
2. Application receives JWT access token
3. Include token in `Authorization` header for all API requests

**Request Headers:**
```
Authorization: Bearer <azure-ad-jwt-token>
```

**Development Mode:**
- In development (`NODE_ENV=development`), authentication is bypassed for testing
- Production deployments MUST have proper Azure AD token verification enabled

**Azure AD Configuration Required:**
- Tenant ID, Client ID, Client Secret configured in environment
- JWT signature verification using Azure AD public keys
- Token claims validation (issuer, audience, expiration)
- See INSTALLATION.md for complete Azure AD setup

### Common Response Codes
- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Meetings API

### GET /api/meetings
Retrieve all meetings with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by status (scheduled, in_progress, completed, archived)
- `classificationLevel` (optional): Filter by classification
- `from` (optional): Start date (ISO 8601)
- `to` (optional): End date (ISO 8601)
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [
    {
      "id": "abc123",
      "title": "Weekly Status Review",
      "description": "Review project progress and blockers",
      "scheduledAt": "2025-10-30T14:00:00Z",
      "duration": "1h 30m",
      "attendees": ["john.doe@company.com", "jane.smith@company.com"],
      "status": "completed",
      "classificationLevel": "Standard",
      "recordingUrl": "https://...",
      "transcriptUrl": "https://...",
      "createdAt": "2025-10-30T12:00:00Z",
      "minutes": {
        "id": "min456",
        "meetingId": "abc123",
        "summary": "Discussed project milestones...",
        "keyDiscussions": ["Budget allocation", "Timeline review"],
        "decisions": ["Approved budget increase"],
        "attendeesPresent": ["john.doe@company.com"],
        "processingStatus": "completed",
        "sharepointUrl": "https://sharepoint.../document.pdf",
        "docxUrl": "https://...",
        "pdfUrl": "https://...",
        "createdAt": "2025-10-30T15:00:00Z",
        "updatedAt": "2025-10-30T15:10:00Z"
      },
      "actionItems": [
        {
          "id": "action789",
          "meetingId": "abc123",
          "minutesId": "min456",
          "task": "Review budget proposal",
          "assignee": "john.doe@company.com",
          "dueDate": "2025-11-05T00:00:00Z",
          "priority": "high",
          "status": "pending",
          "createdAt": "2025-10-30T15:10:00Z"
        }
      ]
    }
  ],
  "total": 145,
  "limit": 50,
  "offset": 0
}
```

### GET /api/meetings/:id
Retrieve a specific meeting by ID.

**Response:**
```json
{
  "id": "abc123",
  "title": "Weekly Status Review",
  // ... (same structure as above)
}
```

### POST /api/meetings
Create a new meeting record.

**Request Body:**
```json
{
  "title": "Emergency Planning Session",
  "description": "Discuss emergency response procedures",
  "scheduledAt": "2025-11-01T10:00:00Z",
  "duration": "2h",
  "attendees": ["user1@company.com", "user2@company.com"],
  "classificationLevel": "Standard"
}
```

**Response:** (201 Created)
```json
{
  "id": "def456",
  "title": "Emergency Planning Session",
  "status": "scheduled",
  // ... full meeting object
}
```

### PATCH /api/meetings/:id
Update meeting details.

**Request Body:**
```json
{
  "status": "completed",
  "recordingUrl": "https://teams.microsoft.com/recordings/xyz"
}
```

**Response:**
```json
{
  "id": "abc123",
  "status": "completed",
  // ... updated meeting object
}
```

### DELETE /api/meetings/:id
Delete a meeting and associated minutes.

**Response:** (204 No Content)

---

## Meeting Minutes API

### GET /api/minutes
Retrieve all meeting minutes.

**Query Parameters:**
- `meetingId` (optional): Filter by meeting ID
- `processingStatus` (optional): Filter by status
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "data": [
    {
      "id": "min456",
      "meetingId": "abc123",
      "summary": "Team discussed quarterly objectives...",
      "keyDiscussions": [
        "Q4 budget planning",
        "Resource allocation"
      ],
      "decisions": [
        "Approved hiring 2 new team members",
        "Increased travel budget by 15%"
      ],
      "attendeesPresent": ["user1@company.com", "user2@company.com"],
      "processingStatus": "completed",
      "sharepointUrl": "https://sharepoint.../minutes.pdf",
      "docxUrl": "https://.../minutes.docx",
      "pdfUrl": "https://.../minutes.pdf",
      "createdAt": "2025-10-30T15:00:00Z",
      "updatedAt": "2025-10-30T15:10:00Z"
    }
  ],
  "total": 98,
  "limit": 50,
  "offset": 0
}
```

### GET /api/minutes/:id
Retrieve specific meeting minutes.

**Response:**
```json
{
  "id": "min456",
  "meetingId": "abc123",
  // ... full minutes object
}
```

### POST /api/minutes/generate
Trigger minutes generation for a meeting.

**Request Body:**
```json
{
  "meetingId": "abc123",
  "transcriptUrl": "https://teams.microsoft.com/transcripts/xyz"
}
```

**Response:** (202 Accepted)
```json
{
  "id": "min789",
  "meetingId": "abc123",
  "processingStatus": "pending",
  "message": "Minutes generation started"
}
```

### GET /api/minutes/:id/download
Download minutes in specified format.

**Query Parameters:**
- `format` (required): "docx" or "pdf"

**Response:**
- Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document (DOCX)
- Content-Type: application/pdf (PDF)
- Content-Disposition: attachment; filename="meeting-minutes-abc123.docx"

---

## Action Items API

### GET /api/action-items
Retrieve all action items.

**Query Parameters:**
- `meetingId` (optional): Filter by meeting
- `assignee` (optional): Filter by assignee email
- `status` (optional): Filter by status (pending, in_progress, completed)
- `priority` (optional): Filter by priority (high, medium, low)
- `dueBefore` (optional): Filter items due before date (ISO 8601)

**Response:**
```json
{
  "data": [
    {
      "id": "action123",
      "meetingId": "abc123",
      "minutesId": "min456",
      "task": "Prepare Q4 budget proposal",
      "assignee": "john.doe@company.com",
      "dueDate": "2025-11-15T00:00:00Z",
      "priority": "high",
      "status": "pending",
      "createdAt": "2025-10-30T15:00:00Z"
    }
  ],
  "total": 34,
  "limit": 50,
  "offset": 0
}
```

### GET /api/action-items/:id
Retrieve specific action item.

### POST /api/action-items
Create a new action item.

**Request Body:**
```json
{
  "meetingId": "abc123",
  "minutesId": "min456",
  "task": "Review security protocols",
  "assignee": "security.officer@company.com",
  "dueDate": "2025-11-10T00:00:00Z",
  "priority": "high"
}
```

**Response:** (201 Created)

### PATCH /api/action-items/:id
Update action item.

**Request Body:**
```json
{
  "status": "completed"
}
```

**Response:**
```json
{
  "id": "action123",
  "status": "completed",
  // ... updated action item
}
```

### DELETE /api/action-items/:id
Delete action item.

**Response:** (204 No Content)

---

## Search API

### GET /api/search
Search across meetings and minutes.

**Query Parameters:**
- `q` (required): Search query
- `type` (optional): Search scope (meetings, minutes, all) [default: all]
- `classificationLevel` (optional): Filter by classification
- `from` (optional): Start date filter
- `to` (optional): End date filter
- `limit` (optional): Results per page
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "results": [
    {
      "type": "meeting",
      "id": "abc123",
      "title": "Budget Planning Session",
      "snippet": "...discussed quarterly budget allocation...",
      "scheduledAt": "2025-10-30T14:00:00Z",
      "classificationLevel": "Standard",
      "relevanceScore": 0.95
    },
    {
      "type": "minutes",
      "id": "min456",
      "meetingId": "abc123",
      "meetingTitle": "Budget Planning Session",
      "snippet": "...approved budget increase of 15%...",
      "relevanceScore": 0.89
    }
  ],
  "total": 23,
  "limit": 20,
  "offset": 0,
  "query": "budget"
}
```

---

## Statistics API

### GET /api/stats
Retrieve dashboard statistics.

**Response:**
```json
{
  "totalMeetings": 234,
  "pendingMinutes": 12,
  "completedMeetings": 198,
  "archivedMeetings": 189,
  "actionItems": {
    "total": 156,
    "pending": 45,
    "inProgress": 23,
    "completed": 88
  },
  "recentActivity": [
    {
      "type": "meeting_processed",
      "meetingId": "abc123",
      "meetingTitle": "Weekly Review",
      "timestamp": "2025-10-30T15:10:00Z"
    }
  ],
  "storageUsed": {
    "documents": "2.4 GB",
    "database": "145 MB"
  },
  "processingMetrics": {
    "averageProcessingTime": 245,  // seconds
    "successRate": 98.5  // percent
  }
}
```

---

## Webhooks API

### POST /api/webhooks/teams
Receive Microsoft Teams meeting events.

**Headers:**
- `Content-Type`: application/json
- `clientState`: Validation token (must match configured value)

**Validation Request:**
```
GET /api/webhooks/teams?validationToken=xxx
```

**Validation Response:**
```
200 OK
Content-Type: text/plain

xxx (echo back the validationToken)
```

**Event Notification:**
```json
{
  "value": [
    {
      "subscriptionId": "sub123",
      "clientState": "your-secret",
      "changeType": "created",
      "resource": "/communications/onlineMeetings/meeting-id",
      "resourceData": {
        "@odata.type": "#Microsoft.Graph.onlineMeeting",
        "id": "meeting-id"
      },
      "subscriptionExpirationDateTime": "2025-12-31T23:59:59Z",
      "tenantId": "tenant-id"
    }
  ]
}
```

**Response:** (202 Accepted)
```json
{
  "received": true,
  "processed": 1
}
```

---

## Health Check API

### GET /health
Application health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-30T16:45:23Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 12  // ms
    },
    "azureOpenAI": {
      "status": "healthy",
      "latency": 145
    },
    "sharepoint": {
      "status": "healthy",
      "latency": 234
    },
    "redis": {
      "status": "healthy",
      "latency": 3
    }
  },
  "uptime": 345678  // seconds
}
```

---

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Meeting ID is required",
    "details": {
      "field": "meetingId",
      "constraint": "required"
    },
    "timestamp": "2025-10-30T16:45:23Z",
    "traceId": "abc-123-def-456"
  }
}
```

### Common Error Codes
- `INVALID_REQUEST`: Invalid request parameters
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource conflict (duplicate)
- `PROCESSING_FAILED`: AI processing failed
- `SHAREPOINT_ERROR`: SharePoint upload failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Unexpected server error

---

## Rate Limiting

All API endpoints are rate-limited:
- **Standard users**: 100 requests per 15 minutes
- **Service accounts**: 1000 requests per 15 minutes

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1698681600
```

When rate limit exceeded:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 300

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please retry after 300 seconds."
  }
}
```

---

## Pagination

List endpoints support pagination:

**Request:**
```
GET /api/meetings?limit=20&offset=40
```

**Response Headers:**
```
X-Total-Count: 234
Link: </api/meetings?limit=20&offset=0>; rel="first",
      </api/meetings?limit=20&offset=20>; rel="prev",
      </api/meetings?limit=20&offset=60>; rel="next",
      </api/meetings?limit=20&offset=220>; rel="last"
```

---

## Webhooks Security

### Signature Verification
Microsoft Graph webhooks include a signature that should be verified:

```javascript
function verifyWebhookSignature(req) {
  const signature = req.headers['x-ms-signature'];
  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', process.env.TEAMS_WEBHOOK_CLIENT_STATE)
    .update(body)
    .digest('base64');
  
  return signature === expected;
}
```

### Client State Validation
```javascript
if (req.body.value[0].clientState !== process.env.TEAMS_WEBHOOK_CLIENT_STATE) {
  return res.status(403).json({ error: 'Invalid client state' });
}
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://your-domain.com/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Get all meetings
const meetings = await client.get('/meetings', {
  params: {
    status: 'completed',
    limit: 50
  }
});

// Create meeting
const newMeeting = await client.post('/meetings', {
  title: 'Project Review',
  scheduledAt: '2025-11-01T14:00:00Z',
  duration: '1h',
  attendees: ['user@company.com'],
  classificationLevel: 'Standard'
});

// Search
const results = await client.get('/search', {
  params: {
    q: 'budget',
    type: 'all',
    limit: 20
  }
});
```

### curl Examples
```bash
# Get meetings
curl -X GET "https://your-domain.com/api/meetings?status=completed" \
  -H "Cookie: dod.teams.sid=xxx" \
  -H "Content-Type: application/json"

# Create meeting
curl -X POST "https://your-domain.com/api/meetings" \
  -H "Cookie: dod.teams.sid=xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Security Briefing",
    "scheduledAt": "2025-11-01T10:00:00Z",
    "duration": "45m",
    "attendees": ["officer@company.com"],
    "classificationLevel": "Standard"
  }'

# Download minutes
curl -X GET "https://your-domain.com/api/minutes/min456/download?format=pdf" \
  -H "Cookie: dod.teams.sid=xxx" \
  -o minutes.pdf
```

---

**Document Classification**: Standard  
**Last Updated**: October 30, 2025  
**Version**: 1.0
