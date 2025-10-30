# Production Deployment Checklist
## DOD Teams Meeting Minutes Management System

**⚠️ CRITICAL: This checklist MUST be completed before production deployment**

## Pre-Deployment Requirements

### 1. Authentication & Authorization ⚠️ CRITICAL
- [ ] **Install JWT validation libraries**
  ```bash
  npm install jsonwebtoken jwks-rsa
  ```

- [ ] **Implement Azure AD JWT token verification** in `server/middleware/auth.ts`
  - [ ] Fetch Azure AD signing keys from Microsoft Identity Platform
  - [ ] Verify token signature using public keys
  - [ ] Validate token claims (issuer, audience, expiration)
  - [ ] Extract user identity from validated token
  - [ ] Map user to security clearance level
  - [ ] Remove all placeholder code and console warnings

- [ ] **Test authentication thoroughly**
  - [ ] Verify invalid tokens are rejected (401)
  - [ ] Verify expired tokens are rejected (401)
  - [ ] Verify tokens from wrong tenant are rejected (401)
  - [ ] Verify missing tokens are rejected (401)
  - [ ] Verify valid tokens allow access (200)

- [ ] **Implement role-based access control**
  - [ ] Define user roles in Azure AD
  - [ ] Map roles to application permissions
  - [ ] Test role enforcement on protected endpoints

- [ ] **Implement clearance-level checks**
  - [ ] Store security clearance levels in user profiles
  - [ ] Verify clearance before accessing classified meetings
  - [ ] Test classification enforcement (UNCLASSIFIED, CONFIDENTIAL, SECRET)

### 2. Azure OpenAI Government Cloud ⚠️ CRITICAL
- [ ] **Provision Azure OpenAI Service in Government Cloud**
  - [ ] Create Azure OpenAI resource in usgovvirginia or usgovarizona
  - [ ] Deploy GPT-4 model (or latest approved model)
  - [ ] Note deployment name, endpoint, and API key

- [ ] **Configure production environment variables**
  ```bash
  AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.us/
  AZURE_OPENAI_API_KEY=your-api-key
  AZURE_OPENAI_DEPLOYMENT=gpt-4-teams-minutes
  AZURE_OPENAI_API_VERSION=2024-02-15-preview
  ```

- [ ] **Test AI integration**
  - [ ] Verify minutes generation works with Azure OpenAI
  - [ ] Verify action item extraction works
  - [ ] Confirm no fallback to Replit AI in production
  - [ ] Verify no warning messages about development mode

### 3. SharePoint Integration ⚠️ REQUIRED
- [ ] **Authorize SharePoint connector**
  - [ ] Complete OAuth flow for production SharePoint tenant
  - [ ] Grant required permissions (Sites.Selected, Files.ReadWrite.All)
  - [ ] Test document upload and metadata tagging

- [ ] **Create SharePoint document library structure**
  - [ ] Create "Meeting Minutes" document library
  - [ ] Add custom columns (Classification, MeetingDate, etc.)
  - [ ] Set up folder structure (YYYY/MM-Month/Classification)
  - [ ] Configure permissions by classification level

### 4. Security Hardening
- [ ] **Environment variables secured**
  - [ ] All secrets stored in AWS Secrets Manager
  - [ ] No secrets in code or version control
  - [ ] Secrets rotation policy configured
  - [ ] Access logs enabled for secret access

- [ ] **HTTPS/TLS configured**
  - [ ] SSL certificate installed on load balancer
  - [ ] HTTP redirects to HTTPS
  - [ ] HSTS header enabled
  - [ ] TLS 1.2+ enforced

- [ ] **Session management**
  - [ ] Secure session cookies (httpOnly, secure, sameSite)
  - [ ] Session timeout configured (1 hour recommended)
  - [ ] Redis or similar for session storage in multi-instance setup

- [ ] **Input validation**
  - [ ] All user inputs validated with Zod schemas
  - [ ] SQL injection protection (using parameterized queries)
  - [ ] XSS protection (React auto-escaping verified)
  - [ ] CSRF protection enabled

- [ ] **Rate limiting**
  - [ ] API rate limits configured
  - [ ] Brute force protection on auth endpoints
  - [ ] DDoS protection via AWS Shield

### 5. AWS Infrastructure
- [ ] **VPC and networking**
  - [ ] VPC created in us-gov-west-1 or us-gov-east-1
  - [ ] Public and private subnets in multiple AZs
  - [ ] NAT gateways for outbound access
  - [ ] Security groups properly configured

- [ ] **Database**
  - [ ] RDS PostgreSQL with encryption at rest
  - [ ] Multi-AZ deployment enabled
  - [ ] Automated backups configured (30-day retention)
  - [ ] SSL connections enforced
  - [ ] Database password rotated

- [ ] **Application servers**
  - [ ] Auto Scaling Group configured (min 2, max 10)
  - [ ] Health checks configured
  - [ ] Application Load Balancer configured
  - [ ] CloudWatch monitoring enabled
  - [ ] Log aggregation configured

### 6. Compliance & Auditing
- [ ] **Logging enabled**
  - [ ] Application logs to CloudWatch
  - [ ] Access logs for all API requests
  - [ ] Authentication attempts logged
  - [ ] Classification level access logged
  - [ ] Log retention policy (1 year minimum)

- [ ] **Audit trail**
  - [ ] All data modifications tracked
  - [ ] User actions logged with timestamps
  - [ ] Document access tracked
  - [ ] Failed authentication attempts tracked

- [ ] **Classification marking**
  - [ ] All documents properly marked with classification
  - [ ] Visual indicators in UI for classification levels
  - [ ] Export headers include classification markings
  - [ ] SharePoint metadata includes classification

### 7. Testing
- [ ] **Security testing**
  - [ ] Penetration testing completed
  - [ ] Vulnerability scan passed
  - [ ] OWASP Top 10 verified
  - [ ] Authentication bypass attempts fail

- [ ] **Functional testing**
  - [ ] End-to-end meeting workflow tested
  - [ ] AI minutes generation tested with real transcripts
  - [ ] SharePoint archival tested
  - [ ] Search functionality tested
  - [ ] All classification levels tested

- [ ] **Performance testing**
  - [ ] Load testing completed (target: 1000 concurrent users)
  - [ ] API response times < 200ms (p95)
  - [ ] Page load times < 2 seconds
  - [ ] AI processing < 5 minutes per hour of meeting

- [ ] **Disaster recovery testing**
  - [ ] Database restore tested
  - [ ] Application failover tested
  - [ ] Backup/restore procedures documented
  - [ ] RTO/RPO targets verified

### 8. Documentation
- [ ] **Operations manual**
  - [ ] Deployment procedures documented
  - [ ] Rollback procedures documented
  - [ ] Incident response procedures
  - [ ] Escalation contacts

- [ ] **User training**
  - [ ] User guides created
  - [ ] Administrator guides created
  - [ ] Training sessions completed
  - [ ] Support contacts established

### 9. Go-Live Preparation
- [ ] **Change management**
  - [ ] Change request approved
  - [ ] Stakeholders notified
  - [ ] Maintenance window scheduled
  - [ ] Rollback plan ready

- [ ] **Monitoring**
  - [ ] CloudWatch dashboards configured
  - [ ] Alarms configured and tested
  - [ ] On-call rotation established
  - [ ] Incident response team ready

- [ ] **Communication**
  - [ ] User communication sent
  - [ ] Support team briefed
  - [ ] Status page updated
  - [ ] Feedback mechanism established

## Post-Deployment Verification

Within 24 hours of deployment:
- [ ] Verify all health checks passing
- [ ] Verify no authentication errors in logs
- [ ] Verify Azure OpenAI integration working (no development fallback)
- [ ] Verify SharePoint uploads working
- [ ] Verify first production meeting processed successfully
- [ ] Verify monitoring and alerting working
- [ ] Verify no security warnings in application logs

Within 1 week of deployment:
- [ ] Review all logs for anomalies
- [ ] Verify performance metrics meet targets
- [ ] Collect user feedback
- [ ] Address any issues identified
- [ ] Schedule security review
- [ ] Update documentation with lessons learned

## Emergency Contacts

- **Security Incidents**: [security-team@dod.gov]
- **Application Support**: [app-support@dod.gov]
- **Azure Support**: [Azure Government Support]
- **AWS Support**: [AWS GovCloud Support]

## Signoff

- [ ] Security Officer: _________________ Date: _______
- [ ] IT Director: _________________ Date: _______
- [ ] Project Manager: _________________ Date: _______
- [ ] Deployment Engineer: _________________ Date: _______

---

**Document Classification**: UNCLASSIFIED  
**Last Updated**: October 30, 2025  
**Version**: 1.0

**⚠️ DO NOT deploy to production until ALL items are checked and signed off.**
