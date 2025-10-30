# DOD Teams Meeting Minutes - AWS Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the Microsoft Teams Meeting Minutes Management System on **AWS (including AWS Gov Cloud)**. The system is designed to be **easy to install and use** with minimal configuration.

---

## Architecture Overview

### AWS Services Used
- **AWS Elastic Beanstalk** or **ECS Fargate**: Application hosting
- **Amazon RDS (PostgreSQL)**: Database
- **AWS Secrets Manager**: Secure credential storage
- **Application Load Balancer**: HTTPS traffic distribution
- **Amazon CloudWatch**: Logging and monitoring
- **AWS Certificate Manager**: SSL/TLS certificates
- **Amazon S3**: Static asset storage (optional)

### Architecture Diagram
```
Internet → ALB (HTTPS) → ECS/Beanstalk → RDS PostgreSQL
                              ↓
                      Secrets Manager
                              ↓
                      Azure AD / Graph API
                              ↓
                      Azure OpenAI (Gov Cloud)
                              ↓
                      SharePoint
```

---

## Prerequisites

- AWS Account (or AWS Gov Cloud account for production)
- Azure AD admin access
- Domain name (optional but recommended)
- AWS CLI installed and configured
- Docker installed (for ECS deployment)

---

## Phase 1: Azure AD App Registration (15 minutes)

### Step 1.1: Create Azure AD App
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: `DOD Teams Meeting Minutes`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: `https://your-domain.com` (update after AWS deployment)
5. Click **Register**
6. **Save these values**:
   - Application (client) ID
   - Directory (tenant) ID

### Step 1.2: Create Client Secret
1. In your app, go to **Certificates & secrets**
2. Click **New client secret**
3. Description: `Teams Meeting Minutes Secret`
4. Expiration: 24 months
5. Click **Add**
6. **IMMEDIATELY copy the secret value**

### Step 1.3: Configure API Permissions
1. Go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `User.Read`
   - `User.ReadBasic.All`
   - `OnlineMeetings.Read`
   - `OnlineMeetingRecording.Read.All`
   - `Mail.Send`
   - `Files.ReadWrite.All`
4. Click **Add permissions**
5. Click **Grant admin consent** (requires admin rights)

---

## Phase 2: AWS Infrastructure Setup (30 minutes)

### Step 2.1: Create RDS PostgreSQL Database
```bash
# Using AWS CLI
aws rds create-db-instance \
  --db-instance-identifier dod-meeting-minutes-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username dbadmin \
  --master-user-password <STRONG_PASSWORD> \
  --allocated-storage 20 \
  --storage-encrypted \
  --vpc-security-group-ids <YOUR_SECURITY_GROUP_ID> \
  --db-subnet-group-name <YOUR_SUBNET_GROUP> \
  --backup-retention-period 7 \
  --multi-az \
  --publicly-accessible false
```

**Or use AWS Console:**
1. Go to **RDS** → **Create database**
2. **Engine**: PostgreSQL 15.4
3. **Templates**: Production (for Gov Cloud) or Dev/Test (for testing)
4. **DB instance identifier**: `dod-meeting-minutes-db`
5. **Master username**: `dbadmin`
6. **Master password**: Strong password
7. **Instance type**: db.t3.medium (or larger for production)
8. **Storage**: 20 GB SSD (auto-scaling enabled)
9. **Multi-AZ**: Yes (for production)
10. **VPC**: Choose your VPC
11. **Public access**: No
12. **Encryption**: Enabled
13. Click **Create database**

**Save these values:**
- Endpoint URL (e.g., `xxx.rds.amazonaws.com`)
- Port: `5432`
- Database name: `postgres` (default)

### Step 2.2: Store Secrets in AWS Secrets Manager
```bash
# Create secret for database connection
aws secretsmanager create-secret \
  --name dod-meeting-minutes/database \
  --description "Database credentials" \
  --secret-string '{
    "username": "dbadmin",
    "password": "<DB_PASSWORD>",
    "host": "<RDS_ENDPOINT>",
    "port": 5432,
    "database": "postgres"
  }'

# Create secret for Microsoft Graph API
aws secretsmanager create-secret \
  --name dod-meeting-minutes/microsoft \
  --description "Microsoft Graph API credentials" \
  --secret-string '{
    "tenantId": "<TENANT_ID>",
    "clientId": "<CLIENT_ID>",
    "clientSecret": "<CLIENT_SECRET>"
  }'

# Create secret for Azure OpenAI
aws secretsmanager create-secret \
  --name dod-meeting-minutes/openai \
  --description "Azure OpenAI credentials" \
  --secret-string '{
    "endpoint": "https://your-resource.openai.azure.com/",
    "apiKey": "<OPENAI_KEY>",
    "deployment": "gpt-4"
  }'

# Create secret for SharePoint
aws secretsmanager create-secret \
  --name dod-meeting-minutes/sharepoint \
  --description "SharePoint configuration" \
  --secret-string '{
    "siteUrl": "https://your-tenant.sharepoint.com/sites/meetingminutes",
    "library": "Meeting Minutes"
  }'

# Create session secret
aws secretsmanager create-secret \
  --name dod-meeting-minutes/session \
  --description "Session secret" \
  --secret-string '{
    "secret": "<RANDOM_STRING_64_CHARS>"
  }'
```

### Step 2.3: Create IAM Role for Application
```bash
# Create IAM policy for Secrets Manager access
cat > secrets-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:dod-meeting-minutes/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
EOF

# Create the policy
aws iam create-policy \
  --policy-name DODMeetingMinutesPolicy \
  --policy-document file://secrets-policy.json

# Create IAM role for ECS task
aws iam create-role \
  --role-name DODMeetingMinutesTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "ecs-tasks.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'

# Attach policy to role
aws iam attach-role-policy \
  --role-name DODMeetingMinutesTaskRole \
  --policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/DODMeetingMinutesPolicy
```

---

## Phase 3: Application Deployment (Choose One Method)

### **Option A: AWS Elastic Beanstalk (Easiest)**

#### Step 3A.1: Prepare Application
Create `.ebextensions/environment.config`:

```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    AWS_REGION: us-east-1  # or us-gov-west-1 for Gov Cloud
```

Create `Procfile`:
```
web: npm run start
```

#### Step 3A.2: Deploy to Elastic Beanstalk
```bash
# Initialize Elastic Beanstalk
eb init -p node.js-20 dod-meeting-minutes --region us-east-1

# Create environment
eb create dod-meeting-minutes-prod \
  --instance-type t3.medium \
  --envvars NODE_ENV=production,AWS_REGION=us-east-1

# Deploy application
eb deploy

# Get the URL
eb status
```

---

### **Option B: AWS ECS Fargate (Production-Grade)**

#### Step 3B.1: Create Dockerfile
Create `Dockerfile` in project root:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]
```

#### Step 3B.2: Build and Push Docker Image
```bash
# Authenticate to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Create ECR repository
aws ecr create-repository \
  --repository-name dod-meeting-minutes \
  --region us-east-1

# Build Docker image
docker build -t dod-meeting-minutes .

# Tag image
docker tag dod-meeting-minutes:latest \
  <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/dod-meeting-minutes:latest

# Push to ECR
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/dod-meeting-minutes:latest
```

#### Step 3B.3: Create ECS Cluster
```bash
# Create cluster
aws ecs create-cluster \
  --cluster-name dod-meeting-minutes-cluster \
  --region us-east-1

# Create task definition
cat > task-definition.json << EOF
{
  "family": "dod-meeting-minutes",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/DODMeetingMinutesTaskRole",
  "containerDefinitions": [
    {
      "name": "dod-meeting-minutes",
      "image": "<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/dod-meeting-minutes:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "AWS_REGION",
          "value": "us-east-1"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:dod-meeting-minutes/database"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/dod-meeting-minutes",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json
```

#### Step 3B.4: Create Application Load Balancer
```bash
# Create target group
aws elbv2 create-target-group \
  --name dod-meeting-minutes-tg \
  --protocol HTTP \
  --port 5000 \
  --vpc-id <YOUR_VPC_ID> \
  --target-type ip \
  --health-check-path /health

# Create load balancer
aws elbv2 create-load-balancer \
  --name dod-meeting-minutes-alb \
  --subnets <SUBNET_ID_1> <SUBNET_ID_2> \
  --security-groups <SECURITY_GROUP_ID> \
  --scheme internet-facing

# Create HTTPS listener (requires ACM certificate)
aws elbv2 create-listener \
  --load-balancer-arn <ALB_ARN> \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<ACM_CERT_ARN> \
  --default-actions Type=forward,TargetGroupArn=<TARGET_GROUP_ARN>
```

#### Step 3B.5: Create ECS Service
```bash
aws ecs create-service \
  --cluster dod-meeting-minutes-cluster \
  --service-name dod-meeting-minutes-service \
  --task-definition dod-meeting-minutes \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[<SUBNET_ID_1>,<SUBNET_ID_2>],
    securityGroups=[<SECURITY_GROUP_ID>],
    assignPublicIp=ENABLED
  }" \
  --load-balancers "targetGroupArn=<TARGET_GROUP_ARN>,containerName=dod-meeting-minutes,containerPort=5000"
```

---

## Phase 4: Update Application Code for AWS

### Step 4.1: Update Database Connection
Create `server/config/aws.ts`:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });

export async function getSecret(secretName: string): Promise<any> {
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    return JSON.parse(response.SecretString || "{}");
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error);
    throw error;
  }
}

export async function loadSecrets() {
  const dbSecret = await getSecret("dod-meeting-minutes/database");
  const msSecret = await getSecret("dod-meeting-minutes/microsoft");
  const openaiSecret = await getSecret("dod-meeting-minutes/openai");
  const sharepointSecret = await getSecret("dod-meeting-minutes/sharepoint");
  const sessionSecret = await getSecret("dod-meeting-minutes/session");

  process.env.DATABASE_URL = `postgresql://${dbSecret.username}:${dbSecret.password}@${dbSecret.host}:${dbSecret.port}/${dbSecret.database}`;
  process.env.MICROSOFT_TENANT_ID = msSecret.tenantId;
  process.env.MICROSOFT_CLIENT_ID = msSecret.clientId;
  process.env.MICROSOFT_CLIENT_SECRET = msSecret.clientSecret;
  process.env.AZURE_OPENAI_ENDPOINT = openaiSecret.endpoint;
  process.env.AZURE_OPENAI_API_KEY = openaiSecret.apiKey;
  process.env.AZURE_OPENAI_DEPLOYMENT = openaiSecret.deployment;
  process.env.SHAREPOINT_SITE_URL = sharepointSecret.siteUrl;
  process.env.SHAREPOINT_LIBRARY = sharepointSecret.library;
  process.env.SESSION_SECRET = sessionSecret.secret;
}
```

### Step 4.2: Update `server/index.ts`
```typescript
import { loadSecrets } from "./config/aws";

async function start() {
  // Load secrets from AWS Secrets Manager
  if (process.env.NODE_ENV === "production") {
    await loadSecrets();
  }

  // Rest of your server startup code...
}

start().catch(console.error);
```

### Step 4.3: Install AWS SDK
```bash
npm install @aws-sdk/client-secrets-manager
```

---

## Phase 5: Azure OpenAI Setup (10 minutes)

### For Testing (Regular Azure OpenAI)
1. Go to [Azure Portal](https://portal.azure.com)
2. Create **Azure OpenAI** resource
3. Deploy **gpt-4** model
4. Copy endpoint and API key to AWS Secrets Manager

### For Production (Azure OpenAI Gov Cloud)
1. Use Azure Government Portal
2. Create OpenAI resource in Gov Cloud region
3. Deploy gpt-4 model
4. Store credentials in AWS Secrets Manager

---

## Phase 6: SharePoint Configuration (15 minutes)

### Step 6.1: Create SharePoint Site
1. Go to SharePoint Admin Center
2. Create site: `Meeting Minutes Archive`
3. Create document library: `Meeting Minutes`
4. Set up classification-based folder structure

### Step 6.2: Configure Permissions
Set up permission groups for different clearance levels

---

## Phase 7: Microsoft Teams App Configuration (20 minutes)

### Step 7.1: Update Teams App Manifest
Replace Replit URL with your AWS domain:

```json
{
  "developer": {
    "websiteUrl": "https://your-domain.com",
    "privacyUrl": "https://your-domain.com/privacy",
    "termsOfUseUrl": "https://your-domain.com/terms"
  },
  "configurableTabs": [
    {
      "configurationUrl": "https://your-domain.com/config"
    }
  ],
  "staticTabs": [
    {
      "contentUrl": "https://your-domain.com"
    }
  ],
  "validDomains": [
    "your-domain.com"
  ],
  "webApplicationInfo": {
    "id": "<CLIENT_ID>",
    "resource": "api://your-domain.com/<CLIENT_ID>"
  }
}
```

### Step 7.2: Package and Install
1. Create ZIP with manifest + icons
2. Upload to Teams
3. Install for organization

---

## Phase 8: Configure Webhooks (15 minutes)

### Register Microsoft Graph Webhook
```powershell
$subscription = @{
  changeType = "created,updated"
  notificationUrl = "https://your-domain.com/api/webhooks/teams"
  resource = "communications/onlineMeetings"
  expirationDateTime = (Get-Date).AddDays(3).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  clientState = "SecretClientState123"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://graph.microsoft.com/v1.0/subscriptions" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $subscription
```

---

## Phase 9: Database Initialization

### Run Migrations
```bash
# SSH into ECS task or Elastic Beanstalk instance
npm run db:push
```

---

## Phase 10: Testing & Monitoring

### Testing Checklist
- [ ] Health check endpoint responds: `https://your-domain.com/health`
- [ ] Users can log in via Teams SSO
- [ ] Meetings captured via webhook
- [ ] AI minutes generation works
- [ ] Approval workflow functional
- [ ] Document export (DOCX/PDF) works
- [ ] SharePoint archival works
- [ ] Access control enforced properly

### CloudWatch Monitoring
1. Create CloudWatch dashboard
2. Monitor metrics:
   - ECS task health
   - RDS connections
   - Application errors
   - API response times
3. Set up alarms for critical issues

---

## Production Hardening

### Security Best Practices
- [ ] Enable WAF on Application Load Balancer
- [ ] Use AWS Shield for DDoS protection
- [ ] Enable VPC Flow Logs
- [ ] Use AWS Config for compliance
- [ ] Enable CloudTrail for audit logging
- [ ] Implement least-privilege IAM policies
- [ ] Enable RDS encryption at rest
- [ ] Use AWS KMS for encryption keys
- [ ] Enable MFA for AWS console access

### High Availability
- [ ] Multi-AZ RDS deployment
- [ ] Multiple ECS tasks across AZs
- [ ] Auto-scaling policies configured
- [ ] Regular database backups
- [ ] Disaster recovery plan documented

### Performance Optimization
- [ ] Enable CloudFront CDN (optional)
- [ ] Configure RDS read replicas for reporting
- [ ] Optimize ECS task CPU/memory
- [ ] Enable ALB connection draining
- [ ] Monitor and tune database queries

---

## Cost Optimization

### Estimated Monthly Costs (Testing)
- RDS db.t3.medium: ~$60
- ECS Fargate (2 tasks): ~$60
- ALB: ~$25
- Secrets Manager: ~$2
- Total: **~$150/month**

### Estimated Monthly Costs (Production - 300K users)
- RDS db.r6g.2xlarge Multi-AZ: ~$1,200
- ECS Fargate (10 tasks): ~$300
- ALB: ~$50
- CloudWatch: ~$30
- Secrets Manager: ~$2
- Data transfer: ~$100
- Total: **~$1,700/month**

### Cost Savings
- Use Reserved Instances for predictable workloads
- Enable auto-scaling to scale down during off-hours
- Use S3 lifecycle policies for old documents
- Enable RDS storage auto-scaling

---

## Troubleshooting

### Issue: Application won't start
**Solution**:
- Check CloudWatch logs: `/ecs/dod-meeting-minutes`
- Verify secrets are accessible
- Check database connectivity
- Review task definition configuration

### Issue: Database connection fails
**Solution**:
- Verify RDS security group allows traffic from ECS tasks
- Check database credentials in Secrets Manager
- Ensure RDS is in same VPC as ECS tasks
- Test connection with psql

### Issue: Teams SSO fails
**Solution**:
- Verify Azure AD redirect URI matches ALB URL
- Check HTTPS certificate is valid
- Review API permissions in Azure AD
- Test token validation endpoint

---

## Next Steps

1. ✅ Complete AWS infrastructure setup
2. ✅ Deploy application to ECS or Elastic Beanstalk
3. ✅ Configure Azure AD and Teams
4. ✅ Set up webhooks
5. ✅ Test thoroughly with small group
6. ✅ Monitor performance and costs
7. ✅ Scale to full organization
8. 🚀 **Go live!**

---

## Support Resources

- **AWS Support**: Use AWS Support Console
- **Azure AD**: Microsoft 365 Admin Center
- **Application Logs**: CloudWatch Logs
- **Database**: RDS Console
- **Security**: AWS Security Hub

---

## Key Advantages of AWS Deployment

✅ **Gov Cloud Ready**: Deploy in AWS Gov Cloud for DOD compliance
✅ **Highly Scalable**: Auto-scaling handles 300,000+ users
✅ **Secure**: VPC isolation, encryption at rest/transit, IAM controls
✅ **Compliant**: FedRAMP, FISMA, NIST certifications
✅ **Reliable**: Multi-AZ deployment, 99.99% SLA
✅ **Cost-Effective**: Pay only for what you use
✅ **Easy Management**: CloudWatch monitoring, automated backups
✅ **Professional**: Enterprise-grade infrastructure
