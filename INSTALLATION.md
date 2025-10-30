# Installation Guide
## DOD Teams Meeting Minutes Management System

### Prerequisites

#### AWS Gov Cloud Account
- Active AWS GovCloud (US) account
- IAM permissions for:
  - EC2, RDS, S3, VPC, ALB, CloudWatch
  - Secrets Manager
  - Certificate Manager

#### Microsoft 365 GCC High/DOD Tenant
- Global Administrator access
- Ability to register Azure AD applications
- SharePoint Online site collection
- Microsoft Teams enabled

#### Azure Government Cloud
- Azure Government subscription
- Azure OpenAI Service access approval
- GPT-4 model deployment capacity

### Installation Steps

## Step 1: Azure AD App Registration

### 1.1 Register Application
```bash
# Navigate to Azure Portal (Government Cloud)
https://portal.azure.us

# Go to Azure Active Directory > App registrations > New registration
Name: DOD-Teams-Minutes-App
Supported account types: Single tenant
Redirect URI: https://your-domain.gov/api/auth/callback
```

### 1.2 Configure API Permissions
```
Microsoft Graph Permissions (Application):
├─ Calendars.Read (read meeting details)
├─ OnlineMeetings.Read.All (access meeting recordings)
├─ OnlineMeetingRecording.Read.All (download recordings)
├─ OnlineMeetingTranscript.Read.All (access transcripts)
├─ Sites.Selected (SharePoint access)
└─ User.Read.All (user information)

# Grant admin consent for all permissions
```

### 1.3 Generate Client Secret
```bash
# In App Registration > Certificates & secrets
# Click "New client secret"
Description: Production Secret
Expires: 24 months

# IMPORTANT: Save the secret value immediately
# Format: abc123def456...
```

### 1.4 Note Application Details
```
Tenant ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Client ID (Application ID): yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
Client Secret: your-secret-value
```

## Step 2: SharePoint Configuration

### 2.1 Create Document Library
```powershell
# Connect to SharePoint Online (GCC High/DOD)
Connect-SPOService -Url https://yourtenant-admin.sharepoint.us

# Navigate to your SharePoint site
https://yourtenant.sharepoint.us/sites/MeetingMinutes

# Create document library
New-PnPList -Title "Meeting Minutes" -Template DocumentLibrary

# Add custom columns
Add-PnPField -List "Meeting Minutes" -DisplayName "Classification" -InternalName "Classification" -Type Choice -Choices "UNCLASSIFIED","CONFIDENTIAL","SECRET"
Add-PnPField -List "Meeting Minutes" -DisplayName "MeetingDate" -InternalName "MeetingDate" -Type DateTime
Add-PnPField -List "Meeting Minutes" -DisplayName "AttendeeCount" -InternalName "AttendeeCount" -Type Number
```

### 2.2 Grant App Permissions
```powershell
# Grant the registered app access to the site
Grant-PnPAzureADAppSitePermission -AppId "your-client-id" -DisplayName "Teams Minutes App" -Permissions "Write"
```

## Step 3: Azure OpenAI Service Setup

### 3.1 Create Azure OpenAI Resource
```bash
# Azure Portal (Government): portal.azure.us
# Create Resource > Azure OpenAI
Resource group: dod-ai-services
Name: dod-teams-openai
Region: usgovvirginia or usgovarizona
Pricing tier: Standard S0
```

### 3.2 Deploy GPT-4 Model
```bash
# Navigate to Azure OpenAI Studio
https://oai.azure.us

# Go to Deployments > Create new deployment
Model: gpt-4
Deployment name: gpt-4-teams-minutes
Tokens per Minute Rate Limit: 120K (adjust as needed)
```

### 3.3 Obtain API Credentials
```
Endpoint: https://dod-teams-openai.openai.azure.us/
API Key: [from Keys and Endpoint section]
Deployment Name: gpt-4-teams-minutes
```

## Step 4: AWS Gov Cloud Infrastructure

### 4.1 VPC Setup
```bash
# Create VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --region us-gov-west-1 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=dod-teams-minutes-vpc}]'

# Create subnets (public and private in 2 AZs)
# Public Subnet AZ1
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-gov-west-1a

# Private Subnet AZ1 (Application)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.10.0/24 \
  --availability-zone us-gov-west-1a

# Private Subnet AZ1 (Database)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.20.0/24 \
  --availability-zone us-gov-west-1a

# Repeat for AZ2 (us-gov-west-1b)
```

### 4.2 Internet Gateway & NAT
```bash
# Create Internet Gateway
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=dod-teams-igw}]'

# Attach to VPC
aws ec2 attach-internet-gateway \
  --vpc-id vpc-xxxxx \
  --internet-gateway-id igw-xxxxx

# Create NAT Gateways (one per AZ for HA)
# Allocate Elastic IPs first
aws ec2 allocate-address --domain vpc

# Create NAT Gateway in public subnet
aws ec2 create-nat-gateway \
  --subnet-id subnet-public-az1 \
  --allocation-id eipalloc-xxxxx
```

### 4.3 RDS PostgreSQL Database
```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name dod-teams-db-subnet \
  --db-subnet-group-description "Subnet group for Teams Minutes DB" \
  --subnet-ids subnet-private-db-az1 subnet-private-db-az2 \
  --region us-gov-west-1

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier dod-teams-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username dbadmin \
  --master-user-password [secure-password] \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --kms-key-id [your-kms-key] \
  --db-subnet-group-name dod-teams-db-subnet \
  --vpc-security-group-ids sg-xxxxx \
  --backup-retention-period 30 \
  --multi-az \
  --region us-gov-west-1
```

### 4.4 Application Load Balancer
```bash
# Create security groups
aws ec2 create-security-group \
  --group-name dod-teams-alb-sg \
  --description "ALB security group" \
  --vpc-id vpc-xxxxx

# Allow HTTPS traffic
aws ec2 authorize-security-group-ingress \
  --group-id sg-alb-xxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Create ALB
aws elbv2 create-load-balancer \
  --name dod-teams-alb \
  --subnets subnet-public-az1 subnet-public-az2 \
  --security-groups sg-alb-xxxxx \
  --scheme internet-facing \
  --type application \
  --region us-gov-west-1
```

### 4.5 EC2 Auto Scaling Group
```bash
# Create Launch Template
aws ec2 create-launch-template \
  --launch-template-name dod-teams-app-template \
  --version-description "v1.0" \
  --launch-template-data '{
    "ImageId": "ami-gov-cloud-ubuntu-22.04",
    "InstanceType": "t3.medium",
    "KeyName": "your-key-pair",
    "SecurityGroupIds": ["sg-app-xxxxx"],
    "IamInstanceProfile": {"Name": "dod-teams-app-role"},
    "UserData": "[base64-encoded-startup-script]",
    "TagSpecifications": [{
      "ResourceType": "instance",
      "Tags": [{"Key": "Name", "Value": "dod-teams-app"}]
    }]
  }'

# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name dod-teams-asg \
  --launch-template LaunchTemplateName=dod-teams-app-template \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2 \
  --vpc-zone-identifier "subnet-private-app-az1,subnet-private-app-az2" \
  --target-group-arns arn:aws-us-gov:elasticloadbalancing:... \
  --health-check-type ELB \
  --health-check-grace-period 300
```

## Step 5: Secrets Management

### 5.1 Store Secrets in AWS Secrets Manager
```bash
# Microsoft App Registration
aws secretsmanager create-secret \
  --name dod-teams/microsoft \
  --secret-string '{
    "tenantId": "your-tenant-id",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret"
  }' \
  --region us-gov-west-1

# Azure OpenAI
aws secretsmanager create-secret \
  --name dod-teams/azure-openai \
  --secret-string '{
    "endpoint": "https://dod-teams-openai.openai.azure.us/",
    "apiKey": "your-api-key",
    "deployment": "gpt-4-teams-minutes"
  }' \
  --region us-gov-west-1

# SharePoint
aws secretsmanager create-secret \
  --name dod-teams/sharepoint \
  --secret-string '{
    "siteUrl": "https://yourtenant.sharepoint.us/sites/MeetingMinutes",
    "libraryName": "Meeting Minutes"
  }' \
  --region us-gov-west-1

# Database
aws secretsmanager create-secret \
  --name dod-teams/database \
  --secret-string '{
    "host": "dod-teams-db.xxxxx.rds.amazonaws-us-gov.com",
    "port": 5432,
    "database": "teamsminutes",
    "username": "dbadmin",
    "password": "your-db-password"
  }' \
  --region us-gov-west-1

# Session Secret
aws secretsmanager create-secret \
  --name dod-teams/session \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-gov-west-1
```

## Step 6: Application Deployment

### 6.1 Build Application
```bash
# Clone repository
git clone https://your-repo.git
cd teams-minutes-app

# Install dependencies
npm install

# Build frontend
cd client
npm run build

# Package application
cd ..
npm run package
```

### 6.2 Create EC2 User Data Script
```bash
#!/bin/bash

# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Create application directory
mkdir -p /opt/teams-minutes
cd /opt/teams-minutes

# Download application package from S3
aws s3 cp s3://your-bucket/teams-minutes-app.tar.gz . --region us-gov-west-1
tar -xzf teams-minutes-app.tar.gz

# Install dependencies
npm install --production

# Fetch secrets and create .env file
aws secretsmanager get-secret-value --secret-id dod-teams/microsoft --region us-gov-west-1 --query SecretString --output text | jq -r 'to_entries|map("\(.key|ascii_upcase)=\(.value)")|.[]' > .env

# Start application with PM2
pm2 start npm --name teams-minutes -- start
pm2 startup systemd
pm2 save

# Configure log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 30
```

### 6.3 Deploy to EC2 Instances
```bash
# Upload application package to S3
aws s3 cp teams-minutes-app.tar.gz s3://your-deployment-bucket/ --region us-gov-west-1

# Update Launch Template with new user data
# This will cause new instances to deploy latest version

# Perform rolling update of Auto Scaling Group
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name dod-teams-asg \
  --preferences MinHealthyPercentage=50
```

## Step 7: Database Migration

### 7.1 Connect to Database
```bash
# From a bastion host or EC2 instance in private subnet
psql -h dod-teams-db.xxxxx.rds.amazonaws-us-gov.com -U dbadmin -d postgres
```

### 7.2 Create Database and Schema
```sql
-- Create database
CREATE DATABASE teamsminutes;

-- Connect to database
\c teamsminutes;

-- Create tables (schema from shared/schema.ts)
CREATE TABLE meetings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP NOT NULL,
  duration TEXT NOT NULL,
  attendees JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  classification_level TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  recording_url TEXT,
  transcript_url TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE meeting_minutes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id VARCHAR NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_discussions JSONB NOT NULL,
  decisions JSONB NOT NULL,
  attendees_present JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  sharepoint_url TEXT,
  docx_url TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE action_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id VARCHAR NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  minutes_id VARCHAR NOT NULL REFERENCES meeting_minutes(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  assignee TEXT NOT NULL,
  due_date TIMESTAMP,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_classification ON meetings(classification_level);
CREATE INDEX idx_meetings_scheduled_at ON meetings(scheduled_at);
CREATE INDEX idx_minutes_meeting_id ON meeting_minutes(meeting_id);
CREATE INDEX idx_minutes_status ON meeting_minutes(processing_status);
CREATE INDEX idx_action_items_meeting_id ON action_items(meeting_id);
CREATE INDEX idx_action_items_assignee ON action_items(assignee);
```

## Step 8: Microsoft Teams Webhook Registration

### 8.1 Register Webhook in Graph API
```bash
# Use Microsoft Graph Explorer or API call
POST https://graph.microsoft.us/v1.0/subscriptions

Authorization: Bearer [access-token]
Content-Type: application/json

{
  "changeType": "created,updated",
  "notificationUrl": "https://your-domain.gov/api/webhooks/teams",
  "resource": "/communications/onlineMeetings",
  "expirationDateTime": "2025-12-31T23:59:59.0000000Z",
  "clientState": "your-secret-validation-token"
}
```

### 8.2 Verify Webhook Endpoint
```bash
# Microsoft will send validation request
# Your application must respond to:
# POST /api/webhooks/teams?validationToken=xxx

# Return validationToken in plain text response
```

## Step 9: SSL/TLS Certificate

### 9.1 Request Certificate (ACM)
```bash
aws acm request-certificate \
  --domain-name your-domain.gov \
  --validation-method DNS \
  --subject-alternative-names *.your-domain.gov \
  --region us-gov-west-1
```

### 9.2 Configure ALB with Certificate
```bash
aws elbv2 create-listener \
  --load-balancer-arn arn:aws-us-gov:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws-us-gov:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws-us-gov:...
```

## Step 10: Monitoring & Logging

### 10.1 CloudWatch Dashboards
```bash
# Create custom dashboard for application metrics
aws cloudwatch put-dashboard \
  --dashboard-name DOD-Teams-Minutes \
  --dashboard-body file://dashboard-config.json
```

### 10.2 Configure Alarms
```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name dod-teams-high-errors \
  --alarm-description "Alert when error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold

# Database connection alarm
aws cloudwatch put-metric-alarm \
  --alarm-name dod-teams-db-connections \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

## Verification Checklist

- [ ] Azure AD app registered with correct permissions
- [ ] Admin consent granted for all Graph API permissions
- [ ] SharePoint document library created and accessible
- [ ] Azure OpenAI GPT-4 model deployed
- [ ] AWS VPC and subnets configured
- [ ] RDS PostgreSQL database created and accessible
- [ ] Auto Scaling Group running with healthy instances
- [ ] Application Load Balancer configured with SSL
- [ ] All secrets stored in Secrets Manager
- [ ] Database schema created successfully
- [ ] Teams webhook registered and verified
- [ ] Application accessible via HTTPS
- [ ] CloudWatch monitoring configured
- [ ] Test meeting processed end-to-end

## Troubleshooting

### Application Won't Start
```bash
# Check PM2 logs
pm2 logs teams-minutes

# Check system logs
journalctl -u cloud-init -f

# Verify environment variables
pm2 env 0
```

### Database Connection Errors
```bash
# Test connection from EC2
psql -h [rds-endpoint] -U dbadmin -d teamsminutes

# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx

# Verify RDS is running
aws rds describe-db-instances --db-instance-identifier dod-teams-db
```

### Teams Webhook Not Receiving Events
```bash
# Verify webhook subscription
GET https://graph.microsoft.us/v1.0/subscriptions

# Check application logs for validation requests
pm2 logs teams-minutes --lines 100

# Ensure publicly accessible endpoint
curl -I https://your-domain.gov/api/webhooks/teams
```

### Azure OpenAI API Errors
```bash
# Test endpoint
curl -X POST https://dod-teams-openai.openai.azure.us/openai/deployments/gpt-4-teams-minutes/chat/completions?api-version=2024-02-15-preview \
  -H "Content-Type: application/json" \
  -H "api-key: [your-key]" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```

## Next Steps

Proceed to [CONFIGURATION.md](./CONFIGURATION.md) for detailed configuration options and [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for API reference.

---

**Document Classification**: UNCLASSIFIED  
**Last Updated**: October 30, 2025  
**Version**: 1.0
