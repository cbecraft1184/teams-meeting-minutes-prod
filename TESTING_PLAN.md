# Testing Plan
## DOD Teams Meeting Minutes Management System

**Document Purpose:** Comprehensive testing strategy for SECRET-level classification handling, multi-phase validation, and production readiness in Azure Government (GCC High)

**Last Updated:** November 13, 2025  
**Status:** Implementation Guide  
**Audience:** QA engineers, test automation engineers, DevOps engineers, security testers

---

## Executive Summary

### Purpose

This document defines the complete testing strategy for validating the DOD Teams Meeting Minutes Management System across functional, security, performance, and compliance dimensions before Azure Government (GCC High) deployment.

### Scope

**In Scope:**
- Unit testing (backend services, utility functions)
- Integration testing (API endpoints, database operations, Graph API)
- End-to-end testing (UI workflows via Playwright)
- Performance/load testing (auto-scaling validation)
- Security testing (SAST, DAST, penetration testing)
- Compliance validation (SECRET-level handling, audit logging)
- Operational readiness (disaster recovery, incident response)

**Out of Scope:**
- User acceptance testing (UAT) - performed by customer
- Accessibility testing automation - manual WCAG validation
- Localization testing - English only
- Hardware compatibility testing - cloud-native application

### Testing Principles

```yaml
Shift-Left Testing:
  - Unit tests written during development
  - Integration tests run on every commit
  - Security scans in CI/CD pipeline
  - Early defect detection reduces cost

Classification-Aware Testing:
  - Test data sanitization for lower environments
  - Separate test suites by classification level
  - Access control validation mandatory
  - No classified data in development/test environments

Automation-First:
  - 80%+ test coverage target
  - Automated regression suite
  - Performance tests in CI/CD
  - Security scans automated

Environment Parity:
  - Test environment mirrors production
  - Azure Government services used in staging
  - Realistic data volumes in load tests
  - Network topology matches production
```

---

## Test Environment Matrix

### Environment Hierarchy

| Environment | Purpose | Data Classification | Azure Subscription | User Access |
|-------------|---------|-------------------|-------------------|-------------|
| **Development** | Feature development | Synthetic (UNCLASS) | Dev subscription | All developers |
| **Integration** | API integration testing | Synthetic (UNCLASS) | Dev subscription | Dev + QA |
| **Staging** | Pre-production validation | Synthetic (UNCLASS-SECRET) | GCC High staging | QA + Security |
| **Production** | Live operations | Real (UNCLASS-SECRET) | GCC High production | Authorized users only |

### Test Data Management

**Synthetic Data Generation:**

```typescript
// server/tests/fixtures/test-data-generator.ts

import { faker } from '@faker-js/faker';

export function generateSyntheticMeeting() {
  return {
    subject: `Test Meeting - ${faker.company.buzzPhrase()}`,
    startTime: faker.date.recent(),
    endTime: faker.date.recent(),
    attendees: Array.from({ length: 5 }, () => ({
      email: `test.user.${faker.string.uuid()}@test.dod.mil`,
      name: faker.person.fullName()
    })),
    classification: faker.helpers.arrayElement(['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET']),
    organizer: 'test.organizer@test.dod.mil'
  };
}

export function generateSyntheticMinutes() {
  return {
    summary: faker.lorem.paragraphs(3),
    keyPoints: Array.from({ length: 5 }, () => faker.lorem.sentence()),
    actionItems: Array.from({ length: 3 }, () => ({
      description: faker.lorem.sentence(),
      assignee: `test.user.${faker.string.uuid()}@test.dod.mil`,
      dueDate: faker.date.future()
    })),
    decisions: Array.from({ length: 2 }, () => faker.lorem.sentence())
  };
}
```

**Data Sanitization Rules:**

```yaml
NEVER use in non-production:
  - Real names of DOD personnel
  - Actual meeting subjects/content
  - Real email addresses (.mil domains)
  - Classified information of any kind
  - Production API keys/secrets

ALWAYS use in non-production:
  - Faker-generated synthetic data
  - test.dod.mil email domain
  - Clearly marked test data
  - Separate Azure AD test tenant
```

---

## Detailed Testing Plan

### Phase 1: Unit Testing (Ongoing - Week 1+)

**Objective:** Validate individual functions and services in isolation

**Test Framework:** Vitest

**Coverage Target:** 80% code coverage

**Step 1.1: Backend Service Unit Tests**

**File**: `server/tests/services/meeting-orchestrator.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeetingOrchestrator } from '../../services/meeting-orchestrator';
import { generateSyntheticMeeting } from '../fixtures/test-data-generator';

describe('MeetingOrchestrator', () => {
  let orchestrator: MeetingOrchestrator;
  
  beforeEach(() => {
    orchestrator = new MeetingOrchestrator();
  });
  
  it('should process new meeting webhook', async () => {
    const meeting = generateSyntheticMeeting();
    const result = await orchestrator.handleNewMeeting(meeting);
    
    expect(result).toBeDefined();
    expect(result.status).toBe('pending');
  });
  
  it('should handle classification upgrade correctly', async () => {
    const meeting = generateSyntheticMeeting();
    meeting.classification = 'SECRET';
    
    const result = await orchestrator.handleNewMeeting(meeting);
    
    expect(result.classification).toBe('SECRET');
    expect(result.requiresApproval).toBe(true);
  });
  
  it('should retry on transient failures', async () => {
    const graphClient = vi.spyOn(orchestrator.graphClient, 'getMeetingDetails')
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce({ id: '123', subject: 'Test' });
    
    const result = await orchestrator.handleNewMeeting(generateSyntheticMeeting());
    
    expect(graphClient).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });
});
```

**Step 1.2: Classification Guard Unit Tests**

**File**: `server/tests/middleware/classification-guard.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Request, Response } from 'express';
import { classificationGuard } from '../../middleware/classification-guard';

describe('Classification Guard', () => {
  it('should allow UNCLASSIFIED user to access UNCLASSIFIED content', async () => {
    const req = mockRequest({ clearance: 'UNCLASSIFIED', classification: 'UNCLASSIFIED' });
    const res = mockResponse();
    const next = vi.fn();
    
    await classificationGuard(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
  
  it('should block CONFIDENTIAL user from SECRET content', async () => {
    const req = mockRequest({ clearance: 'CONFIDENTIAL', classification: 'SECRET' });
    const res = mockResponse();
    const next = vi.fn();
    
    await classificationGuard(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  
  it('should log unauthorized access attempts', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const req = mockRequest({ clearance: 'UNCLASSIFIED', classification: 'SECRET' });
    const res = mockResponse();
    
    await classificationGuard(req, res, vi.fn());
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('SECURITY: Unauthorized access attempt')
    );
  });
});
```

**Test Execution:**

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Phase 2: Integration Testing (Week 2-3)

**Objective:** Validate API endpoints, database operations, and external integrations

**Step 2.1: API Endpoint Integration Tests**

**File**: `server/tests/integration/meetings-api.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../index';
import { db } from '../../db';
import { generateSyntheticMeeting } from '../fixtures/test-data-generator';

describe('Meetings API', () => {
  let authToken: string;
  
  beforeAll(async () => {
    // Setup test database
    await db.migrate.latest();
    authToken = await getTestAuthToken();
  });
  
  afterAll(async () => {
    // Cleanup
    await db.migrate.rollback();
  });
  
  it('GET /api/meetings should return meetings list', async () => {
    const response = await request(app)
      .get('/api/meetings')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    expect(response.body).toBeInstanceOf(Array);
  });
  
  it('POST /api/meetings/:id/approve should approve minutes', async () => {
    // Create test meeting
    const meeting = await createTestMeeting();
    
    const response = await request(app)
      .post(`/api/meetings/${meeting.id}/approve`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ comments: 'Approved' })
      .expect(200);
    
    expect(response.body.status).toBe('approved');
  });
  
  it('should return 403 for insufficient clearance', async () => {
    const secretMeeting = await createTestMeeting({ classification: 'SECRET' });
    const unclassToken = await getTestAuthToken({ clearance: 'UNCLASSIFIED' });
    
    await request(app)
      .get(`/api/meetings/${secretMeeting.id}`)
      .set('Authorization', `Bearer ${unclassToken}`)
      .expect(403);
  });
});
```

**Step 2.2: Database Integration Tests**

**File**: `server/tests/integration/database.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { db } from '../../db';
import { meetings, meetingMinutes, actionItems } from '@shared/schema';

describe('Database Operations', () => {
  it('should insert meeting with proper constraints', async () => {
    const meeting = await db.insert(meetings).values({
      graphMeetingId: 'test-123',
      subject: 'Test Meeting',
      startTime: new Date(),
      endTime: new Date(),
      classification: 'UNCLASSIFIED'
    }).returning();
    
    expect(meeting[0].id).toBeDefined();
    expect(meeting[0].classification).toBe('UNCLASSIFIED');
  });
  
  it('should cascade delete action items when minutes deleted', async () => {
    const meeting = await createTestMeeting();
    const minutes = await createTestMinutes(meeting.id);
    await createTestActionItem(minutes.id);
    
    await db.delete(meetingMinutes).where(eq(meetingMinutes.id, minutes.id));
    
    const items = await db.select().from(actionItems).where(eq(actionItems.minutesId, minutes.id));
    expect(items.length).toBe(0);
  });
  
  it('should enforce classification enum constraint', async () => {
    await expect(
      db.insert(meetings).values({
        subject: 'Test',
        classification: 'INVALID' as any // Invalid classification
      })
    ).rejects.toThrow();
  });
});
```

### Phase 3: End-to-End Testing (Week 3-4)

**Objective:** Validate complete user workflows via browser automation

**Test Framework:** Playwright

**Step 3.1: E2E Test Setup**

**File**: `tests/e2e/setup.ts`

```typescript
import { test as base, expect } from '@playwright/test';
import { authenticateWithTestUser } from './auth-helpers';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Authenticate before each test
    await authenticateWithTestUser(page, { clearance: 'SECRET' });
    await use(page);
  }
});

export { expect };
```

**Step 3.2: Meeting Approval Workflow E2E Test**

**File**: `tests/e2e/meeting-approval.spec.ts`

```typescript
import { test, expect } from './setup';

test.describe('Meeting Approval Workflow', () => {
  test('should approve meeting minutes end-to-end', async ({ authenticatedPage: page }) => {
    // Navigate to meetings list
    await page.goto('/meetings');
    
    // Find pending meeting
    await expect(page.getByTestId('card-meeting-1')).toBeVisible();
    await page.getByTestId('card-meeting-1').click();
    
    // Verify meeting details page
    await expect(page.getByTestId('text-meeting-subject')).toBeVisible();
    await expect(page.getByTestId('badge-classification-secret')).toBeVisible();
    
    // Approve minutes
    await page.getByTestId('button-approve').click();
    
    // Confirm approval dialog
    await page.getByTestId('input-approval-comments').fill('Approved after review');
    await page.getByTestId('button-confirm-approval').click();
    
    // Verify success
    await expect(page.getByText('Minutes approved successfully')).toBeVisible();
    await expect(page.getByTestId('badge-status-approved')).toBeVisible();
  });
  
  test('should prevent unapproved document download', async ({ authenticatedPage: page }) => {
    await page.goto('/meetings/1');
    
    // Download button should be disabled for pending minutes
    const downloadBtn = page.getByTestId('button-download-minutes');
    await expect(downloadBtn).toBeDisabled();
  });
});
```

**Step 3.3: Classification Access Control E2E Test**

**File**: `tests/e2e/classification-access.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { authenticateWithTestUser } from './auth-helpers';

test('CONFIDENTIAL user cannot access SECRET content', async ({ page }) => {
  // Authenticate as CONFIDENTIAL clearance user
  await authenticateWithTestUser(page, { clearance: 'CONFIDENTIAL' });
  
  // Attempt to access SECRET meeting
  await page.goto('/meetings/secret-meeting-123');
  
  // Should see access denied message
  await expect(page.getByText('Insufficient clearance level')).toBeVisible();
  await expect(page.getByText('Required: SECRET')).toBeVisible();
  await expect(page.getByText('Your level: CONFIDENTIAL')).toBeVisible();
});
```

### Phase 4: Performance & Load Testing (Week 4-5)

**Objective:** Validate auto-scaling to 300,000 concurrent users

**Test Framework:** k6

**Step 4.1: Load Test Script**

**File**: `tests/load/meeting-list-load.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '5m', target: 1000 },    // Ramp up to 1K users
    { duration: '10m', target: 10000 },  // Ramp to 10K users
    { duration: '10m', target: 50000 },  // Ramp to 50K users
    { duration: '5m', target: 100000 },  // Ramp to 100K users
    { duration: '10m', target: 100000 }, // Stay at 100K
    { duration: '5m', target: 0 },       // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    'errors': ['rate<0.01'], // Error rate < 1%
  },
};

export default function () {
  const response = http.get('https://meeting-minutes.app.mil/api/meetings', {
    headers: { 'Authorization': `Bearer ${__ENV.TEST_TOKEN}` }
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);
  
  sleep(1);
}
```

**Step 4.2: Auto-Scaling Validation**

```bash
# Run load test with Azure Load Testing
az load test create \
  --name "meeting-minutes-load-test" \
  --resource-group "meeting-minutes-rg" \
  --test-plan "tests/load/meeting-list-load.js" \
  --engine-instances 10 \
  --duration 3600

# Monitor App Service auto-scaling
az monitor metrics list \
  --resource "/subscriptions/<SUB>/resourceGroups/meeting-minutes-rg/providers/Microsoft.Web/sites/meeting-minutes-app" \
  --metric "CpuPercentage,MemoryPercentage,Requests" \
  --interval PT1M
```

**Expected Behavior:**
- App Service scales from 2 → 20 instances as load increases
- Response time p95 stays <500ms throughout
- Database connections pool efficiently
- No 503 errors during scale-out

### Phase 5: Security Testing (Week 5-6)

**Objective:** Identify and remediate security vulnerabilities

**Step 5.1: Static Application Security Testing (SAST)**

```bash
# Run Semgrep security scans
semgrep --config=p/owasp-top-ten --config=p/secrets server/

# Run npm audit
npm audit --production

# Check for hardcoded secrets
trufflehog filesystem . --only-verified
```

**Step 5.2: Dynamic Application Security Testing (DAST)**

```bash
# OWASP ZAP baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://staging.meeting-minutes.app.mil \
  -r zap-report.html

# Check for common vulnerabilities
- SQL Injection
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)
- Insecure deserialization
- Broken authentication
```

**Step 5.3: Penetration Testing**

```yaml
Engagement: Third-party security firm
Duration: 2 weeks
Scope:
  - Web application (all authenticated endpoints)
  - API security
  - Authentication/authorization bypass
  - Data exfiltration attempts
  - Privilege escalation
  
Out of Scope:
  - Physical security
  - Social engineering
  - DOS/DDOS attacks
  
Deliverable:
  - Detailed penetration test report
  - CVSS scored vulnerabilities
  - Remediation recommendations
  - Retest of high/critical findings
```

### Phase 6: Compliance Validation (Week 6-7)

**Objective:** Verify SECRET-level classification handling and audit logging

**Test Case 1: Classification Downgrade Prevention**

```typescript
test('should prevent classification downgrade', async () => {
  const secretMeeting = await createTestMeeting({ classification: 'SECRET' });
  
  // Attempt to downgrade to CONFIDENTIAL
  const response = await request(app)
    .patch(`/api/meetings/${secretMeeting.id}`)
    .set('Authorization', `Bearer ${secretToken}`)
    .send({ classification: 'CONFIDENTIAL' })
    .expect(403);
  
  expect(response.body.error).toContain('Cannot downgrade classification');
});
```

**Test Case 2: Audit Log Completeness**

```typescript
test('should log all classified data access', async () => {
  const secretMeeting = await createTestMeeting({ classification: 'SECRET' });
  
  // Access meeting
  await request(app)
    .get(`/api/meetings/${secretMeeting.id}`)
    .set('Authorization', `Bearer ${secretToken}`)
    .expect(200);
  
  // Query audit logs
  const logs = await queryAuditLogs({
    eventType: 'CLASSIFIED_DATA_ACCESS',
    resourceId: secretMeeting.id
  });
  
  expect(logs.length).toBeGreaterThan(0);
  expect(logs[0]).toMatchObject({
    user: expect.any(String),
    classification: 'SECRET',
    action: 'GET /api/meetings/:id',
    timestamp: expect.any(String)
  });
});
```

### Phase 7: Operational Readiness (Week 7-8)

**Objective:** Validate disaster recovery and incident response

**Step 7.1: Disaster Recovery Drill**

```yaml
Scenario: Azure region outage

Steps:
  1. Simulate primary region failure
  2. Trigger failover to secondary region
  3. Verify application availability
  4. Validate data consistency
  5. Test read/write operations
  6. Document failover time

Success Criteria:
  - RTO (Recovery Time Objective): <1 hour
  - RPO (Recovery Point Objective): <15 minutes
  - Zero data loss
  - All services operational
```

**Step 7.2: Incident Response Drill**

```yaml
Scenario: Unauthorized SECRET data access attempt

Steps:
  1. Simulate unauthorized access (CONFIDENTIAL user → SECRET data)
  2. Verify alert triggered within 15 minutes
  3. ISSO/ISSM notified
  4. User account automatically suspended
  5. Incident ticket created
  6. Audit logs reviewed
  7. Root cause identified
  8. Lessons learned documented

Success Criteria:
  - Alert within 15 minutes
  - Account suspension within 30 minutes
  - Incident documented within 1 hour
  - POA&M item created if needed
```

---

## Test Execution Schedule

### CI/CD Pipeline (Automated)

```yaml
On Every Commit:
  - Unit tests (5 minutes)
  - Linting/formatting checks (2 minutes)
  - SAST scans (5 minutes)
  - Build verification (3 minutes)

On Pull Request:
  - All commit checks
  - Integration tests (15 minutes)
  - Code coverage report (>80% required)
  - Security dependency scan

On Merge to Main:
  - All PR checks
  - E2E tests (30 minutes)
  - Deploy to staging
  - Smoke tests on staging

On Release Tag:
  - All checks
  - Performance tests (2 hours)
  - DAST scans (4 hours)
  - Deploy to production (manual approval)
```

### Manual Testing Cadence

| Test Type | Frequency | Owner | Duration |
|-----------|-----------|-------|----------|
| **Penetration Testing** | Annually | 3rd party firm | 2 weeks |
| **Disaster Recovery Drill** | Quarterly | Operations | 4 hours |
| **Incident Response Drill** | Quarterly | Security | 2 hours |
| **Accessibility Audit** | Before each release | QA + Accessibility specialist | 1 week |
| **Load Testing** | Before major releases | DevOps | 1 day |
| **Security Audit** | Annually (for ATO) | ISSO/ISSM | 2 weeks |

---

## Validation & Acceptance Criteria

### Test Coverage Acceptance Criteria

**TAC-1: Code Coverage**
- ✅ Unit test coverage ≥80%
- ✅ Integration test coverage ≥70%
- ✅ E2E test coverage: All critical user flows
- ✅ Zero critical/high vulnerabilities

**TAC-2: Performance**
- ✅ API response time p95 <500ms
- ✅ Page load time <2s
- ✅ Auto-scaling verified up to 100K concurrent users
- ✅ Database query performance optimized

**TAC-3: Security**
- ✅ SAST: Zero critical, <5 high findings
- ✅ DAST: Zero critical, <10 high findings
- ✅ Penetration test: All findings remediated
- ✅ Secrets scanning: No hardcoded credentials

**TAC-4: Compliance**
- ✅ Classification access control: 100% test pass rate
- ✅ Audit logging: All events captured
- ✅ Data encryption: Verified at rest and in transit
- ✅ Authentication: CAC/PIV enforcement verified

---

## Appendices

### Appendix A: Test Tool Stack

| Purpose | Tool | Version | Justification |
|---------|------|---------|---------------|
| **Unit Testing** | Vitest | 2.x | Fast, TypeScript native, Vite integration |
| **E2E Testing** | Playwright | 1.x | Cross-browser, GCC High compatible |
| **API Testing** | Supertest | 7.x | Express integration, simple assertions |
| **Load Testing** | k6 | 0.x | Cloud-native, Grafana integration |
| **SAST** | Semgrep | Latest | Policy-as-code, OWASP rules |
| **DAST** | OWASP ZAP | Latest | Industry standard, free |
| **Coverage** | Istanbul/c8 | Latest | Built-in Vitest support |

### Appendix B: Test Data Cleanup

```typescript
// Automated cleanup after each test run
afterEach(async () => {
  // Delete test meetings
  await db.delete(meetings).where(sql`subject LIKE 'Test Meeting%'`);
  
  // Delete test users (if created)
  await db.delete(users).where(sql`email LIKE '%@test.dod.mil'`);
  
  // Clear test cache
  await redis.flushdb();
});

// Manual cleanup for abandoned test data
async function cleanupAbandonedTestData() {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - 24);
  
  await db.delete(meetings).where(
    and(
      sql`subject LIKE 'Test%'`,
      lt(meetings.createdAt, cutoffDate)
    )
  );
}
```

### Appendix C: Bug Severity Classification

| Severity | Definition | Examples | Response Time |
|----------|-----------|----------|---------------|
| **P0 - Critical** | Blocks production deployment | Data loss, security breach, complete outage | 4 hours |
| **P1 - High** | Major functionality broken | Classification bypass, auth failure | 1 day |
| **P2 - Medium** | Feature partially broken | UI glitch, slow performance | 3 days |
| **P3 - Low** | Minor issue | Cosmetic bug, typo | 1 week |
| **P4 - Trivial** | Enhancement request | Nice-to-have feature | Backlog |

---

## Production Readiness Gates

### Gate 1: Test Coverage & Quality

**Required Before Production:**
- ✅ Unit test coverage ≥80% (all critical paths covered)
- ✅ Integration test coverage ≥70% (all APIs tested)
- ✅ E2E tests cover all critical user workflows
- ✅ Zero P0/P1 bugs in test results
- ✅ All security tests passing (SAST, DAST, penetration test)

**Validation:**
- Run full test suite: `npm run test:all`
- Generate coverage report: verify ≥80% unit, ≥70% integration
- Review bug tracker: 0 open P0/P1 issues
- Verify all E2E tests green for 7 consecutive days
- Review penetration test report: all findings remediated

### Gate 2: Performance & Scalability

**Required Before Production:**
- ✅ Load test: 100,000 concurrent users sustained for 1 hour
- ✅ API response time p95 <500ms under load
- ✅ Auto-scaling validated (2 → 20+ instances)
- ✅ Database query performance optimized (all queries <100ms)
- ✅ No memory leaks in 48-hour soak test

**Validation:**
- Execute k6 load test with 100K virtual users
- Monitor metrics: verify p95 latency <500ms
- Observe App Service scaling: 2 → 20 instances
- Run 48-hour soak test: verify stable memory usage
- Database slow query log: 0 queries >100ms

### Gate 3: Security Testing Completion

**Required Before Production:**
- ✅ SAST scan: 0 critical, <5 high findings
- ✅ DAST scan: 0 critical, <10 high findings
- ✅ Dependency audit: 0 critical vulnerabilities
- ✅ Secrets scanning: 0 exposed secrets
- ✅ Third-party penetration test completed and passed

**Validation:**
- Run Semgrep: review findings report
- Run OWASP ZAP: verify baseline passes
- Execute: `npm audit --production` (0 critical)
- TruffleHog scan: 0 secrets found
- Penetration test report: all critical/high remediated

### Gate 4: Compliance Testing

**Required Before Production:**
- ✅ Classification access control: 100% test pass rate
- ✅ CAC/PIV authentication: enforced and tested
- ✅ Audit logging: 100% event capture validated
- ✅ Data encryption: verified at rest and in transit
- ✅ WCAG 2.1 AA accessibility: manual audit passed

**Validation:**
- Run classification test suite: 100% pass
- Test CAC/PIV enforcement: non-PIV blocked
- Query audit logs: verify 100% capture rate
- SSL Labs test: A+ rating
- Accessibility audit: WCAG 2.1 AA checklist complete

### Gate 5: Operational Readiness

**Required Before Production:**
- ✅ Disaster recovery drill executed successfully
- ✅ Incident response drill completed (P1 scenario)
- ✅ Monitoring dashboards deployed and tested
- ✅ On-call runbooks finalized and reviewed
- ✅ Support team trained on troubleshooting

**Validation:**
- DR drill: RTO <1 hour, RPO <15 minutes achieved
- IR drill: MTTD <15 minutes, MTTR <1 hour achieved
- Review monitoring dashboard with operations team
- Walk through runbooks with on-call rotation
- Conduct knowledge transfer session with support team

### Gate 6: Regression & Smoke Testing

**Required Before Production:**
- ✅ Full regression suite passing (all previous features work)
- ✅ Smoke test suite defined for post-deployment validation
- ✅ Rollback procedure tested and documented
- ✅ Blue/green deployment tested in staging
- ✅ Health check endpoints implemented and tested

**Validation:**
- Execute full regression suite: 100% pass rate
- Run smoke tests in staging: verify all critical paths
- Test rollback: deploy, rollback, verify previous version
- Blue/green deployment: test zero-downtime deployment
- Health checks: /health, /ready endpoints return 200

**Production Deployment Approval:**  
Requires sign-off from: QA Lead, Security Lead, Operations Lead, System Owner

---

**Document Version:** 1.0  
**Last Reviewed:** November 13, 2025  
**Next Review:** Before each major release or ATO package submission
