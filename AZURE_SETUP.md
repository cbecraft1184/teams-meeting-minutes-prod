# Azure AD Application Setup Guide

**Purpose**: Register Azure AD application and configure Microsoft Graph API permissions for DOD Teams Meeting Minutes Management System

**Target Audience**: System administrators with Azure AD Global Administrator or Application Administrator role

**Estimated Time**: 30-45 minutes

---

## Prerequisites

- [ ] Azure AD tenant (Microsoft 365 Commercial for testing, DOD/Gov Cloud for production)
- [ ] Global Administrator or Application Administrator role
- [ ] Access to Azure Portal (https://portal.azure.com)
- [ ] Access to Replit workspace with admin permissions

---

## Part 1: Register Azure AD Application

### Step 1: Navigate to App Registrations

1. Sign in to **Azure Portal**: https://portal.azure.com
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **+ New registration**

### Step 2: Configure Basic Settings

**Application Name**: `DOD Teams Meeting Minutes System` (or your preferred name)

**Supported account types**: 
- Select **Accounts in this organizational directory only (Single tenant)**

**Redirect URIs**:
- Platform: **Web**
- Add the following redirect URIs:
  - `https://<your-replit-workspace>.replit.app/auth/callback` (replace with actual Replit URL)
  - `https://your-production-domain.com/auth/callback` (placeholder for production)
- Also add (for Teams mobile/desktop SSO):
  - Platform: **Public client (Mobile & Desktop)**
  - URI: `https://login.microsoftonline.com/common/oauth2/nativeclient`

**Click**: **Register**

### Step 3: Note Application IDs

After registration, you'll see the app overview page. **Copy and save these values**:

- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

## Part 2: Configure API Permissions

### Step 4: Add Microsoft Graph Permissions

1. In your app registration, navigate to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**

### Delegated Permissions (User context - for Teams SSO)

Add the following delegated permissions:

| Permission | Purpose |
|-----------|---------|
| `User.Read` | Read signed-in user profile |
| `OnlineMeetings.Read` | Read user's meetings |
| `Group.Read.All` | Read user's group memberships (for access control) |
| `Mail.Send` | Send email as the signed-in user |

**To add**:
1. Click **Delegated permissions**
2. Search for each permission above
3. Check the permission
4. Click **Add permissions**

### Application Permissions (Service context - for background jobs)

Add the following application permissions:

| Permission | Purpose |
|-----------|---------|
| `User.Read.All` | Read all users' profiles |
| `Group.Read.All` | Read all group memberships (for Azure AD group sync) |
| `OnlineMeetings.Read.All` | Read all online meetings (for webhook capture) |
| `Calendars.Read` | Read meeting schedules |
| `Mail.Send` | Send email as application (for distribution) |
| `Sites.Selected` | Access selected SharePoint sites (for archival) |

**Alternative for SharePoint**:
- If `Sites.Selected` is not available, use `Files.Read.All` or `Sites.Read.All`

**To add**:
1. Click **Application permissions**
2. Search for each permission above
3. Check the permission
4. Click **Add permissions**

### Step 5: Grant Admin Consent

**Critical**: Application permissions require admin consent

1. In the **API permissions** page, click **Grant admin consent for [Your Organization]**
2. Confirm by clicking **Yes**
3. Verify all permissions show **Granted for [Your Organization]** with green checkmarks

---

## Part 3: Configure Authentication

### Step 6: Enable Token Configuration

1. Navigate to **Authentication** in your app
2. Under **Implicit grant and hybrid flows**, enable:
   - ✅ **Access tokens** (used for implict flows)
   - ✅ **ID tokens** (used for implict flows)
3. Under **Advanced settings**:
   - Allow public client flows: **Yes** (for Teams mobile/desktop SSO)
4. Click **Save**

---

## Part 4: Create Client Secrets

### Step 7: Generate Application Secrets

1. Navigate to **Certificates & secrets**
2. Click **+ New client secret**

**For Delegated Flow Secret**:
- Description: `DOD Meeting Minutes - Delegated Auth`
- Expires: **24 months** (recommended) or **Custom** based on policy
- Click **Add**
- **IMMEDIATELY COPY THE SECRET VALUE** (it won't be shown again)
- Save as: `GRAPH_CLIENT_SECRET_DEV` (for development)

**For Application Flow Secret** (if using separate secrets):
- Description: `DOD Meeting Minutes - Application Auth`
- Expires: **24 months**
- Click **Add**
- **IMMEDIATELY COPY THE SECRET VALUE**
- Save as: `GRAPH_APP_SECRET_DEV`

**Note**: You can use a single secret for both flows if preferred.

---

## Part 5: Configure SharePoint Site Access

### Step 8: Grant SharePoint Permissions (Sites.Selected)

If using `Sites.Selected` permission (recommended for least privilege):

1. Navigate to your SharePoint site (e.g., `https://yourorg.sharepoint.com/sites/meetings`)
2. Obtain the **Site ID**:
   - Use Graph Explorer: `https://developer.microsoft.com/graph/graph-explorer`
   - Query: `GET https://graph.microsoft.com/v1.0/sites/yourorg.sharepoint.com:/sites/meetings`
   - Copy the `id` field
3. Grant application access to the site using Graph API:
   ```bash
   POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions
   Content-Type: application/json
   
   {
     "roles": ["write"],
     "grantedToIdentities": [{
       "application": {
         "id": "{your-app-client-id}",
         "displayName": "DOD Teams Meeting Minutes System"
       }
     }]
   }
   ```
4. Verify access by querying: `GET https://graph.microsoft.com/v1.0/sites/{site-id}/drive`

**Alternative**: If using `Files.Read.All` or `Sites.Read.All`, no additional site-specific setup is needed (but less secure).

---

## Part 6: Configure Azure OpenAI Access

### Step 9: Set Up Azure OpenAI Service

**For Commercial Testing** (Development):

1. Navigate to **Azure Portal** > **Create a resource**
2. Search for **Azure OpenAI**
3. Click **Create**
4. Configure:
   - **Subscription**: Your Azure subscription
   - **Resource group**: Create new or use existing
   - **Region**: East US, West Europe, or other available region
   - **Name**: `dod-meeting-minutes-openai-dev`
   - **Pricing tier**: Standard
5. Click **Review + create** > **Create**
6. Wait for deployment (2-5 minutes)
7. Navigate to resource > **Keys and Endpoint**
8. Copy:
   - **KEY 1**: Save as `AZURE_OPENAI_API_KEY_DEV`
   - **Endpoint**: Save as `AZURE_OPENAI_ENDPOINT_DEV` (e.g., `https://dod-meeting-minutes-openai-dev.openai.azure.com/`)

### Step 10: Deploy GPT-4 Model

1. In Azure OpenAI resource, navigate to **Model deployments** (or use Azure OpenAI Studio)
2. Click **+ Create new deployment**
3. Configure:
   - **Model**: `gpt-4` or `gpt-4-32k` (recommended for long transcripts)
   - **Deployment name**: `gpt-4` (this becomes your `AZURE_OPENAI_DEPLOYMENT_DEV`)
   - **Model version**: Latest available
4. Click **Create**
5. Verify deployment is successful
6. **Save deployment name**: `AZURE_OPENAI_DEPLOYMENT_DEV=gpt-4`

**For DOD Gov Cloud** (Production):

1. Follow same steps but in **Azure Government Portal**: https://portal.azure.us
2. Use Gov Cloud specific regions (e.g., USGov Virginia, USGov Arizona)
3. Save separate credentials:
   - `AZURE_OPENAI_API_KEY_PROD`
   - `AZURE_OPENAI_ENDPOINT_PROD` (e.g., `https://*.openai.azure.us/`)
   - `AZURE_OPENAI_DEPLOYMENT_PROD=gpt-4`

---

## Part 7: Configure SharePoint Connector in Replit

### Step 11: SharePoint Integration Setup

The Replit SharePoint connector is already installed in your workspace.

1. In Replit, navigate to **Secrets** (Tools > Secrets)
2. Check if SharePoint connector has created these secrets:
   - `SHAREPOINT_CLIENT_ID`
   - `SHAREPOINT_CLIENT_SECRET`
   - `SHAREPOINT_TENANT_ID`
   - `SHAREPOINT_SITE_URL`

**If not configured**:
1. Use `use_integration` tool to propose SharePoint setup
2. Follow Replit's OAuth flow to connect to SharePoint
3. Select your target site (e.g., `/sites/meetings`)
4. Grant consent for document library access

---

## Part 8: Store Secrets in Replit

### Step 12: Configure Development Secrets

In Replit workspace, navigate to **Tools** > **Secrets** and add:

#### Microsoft Graph Secrets (Development)

| Secret Key | Value | Source |
|-----------|-------|--------|
| `GRAPH_TENANT_ID_DEV` | Your tenant ID | Step 3 |
| `GRAPH_CLIENT_ID_DEV` | Your application client ID | Step 3 |
| `GRAPH_CLIENT_SECRET_DEV` | Client secret value | Step 7 |
| `GRAPH_APP_SECRET_DEV` | Application secret (if separate) | Step 7 |

#### Azure OpenAI Secrets (Development)

| Secret Key | Value | Source |
|-----------|-------|--------|
| `AZURE_OPENAI_ENDPOINT_DEV` | Azure OpenAI endpoint URL | Step 9 |
| `AZURE_OPENAI_API_KEY_DEV` | Azure OpenAI API key | Step 9 |
| `AZURE_OPENAI_DEPLOYMENT_DEV` | Model deployment name (e.g., `gpt-4`) | Step 10 |

#### SharePoint Secrets (via Replit Connector)

These should be auto-configured by Replit SharePoint connector:

| Secret Key | Value | Source |
|-----------|-------|--------|
| `SHAREPOINT_TENANT_ID` | SharePoint tenant ID | Connector |
| `SHAREPOINT_SITE_URL` | Site URL (e.g., `https://yourorg.sharepoint.com/sites/meetings`) | Connector |
| `SHAREPOINT_LIBRARY` | Document library name (e.g., `Meeting Minutes`) | Manual entry |

### Step 13: Configure Production Secrets (Later)

When ready for DOD Gov Cloud deployment, add parallel production secrets:

| Secret Key | Description |
|-----------|-------------|
| `GRAPH_TENANT_ID_PROD` | DOD Gov Cloud tenant ID |
| `GRAPH_CLIENT_ID_PROD` | DOD application client ID |
| `GRAPH_CLIENT_SECRET_PROD` | DOD client secret |
| `AZURE_OPENAI_ENDPOINT_PROD` | Azure OpenAI Gov Cloud endpoint |
| `AZURE_OPENAI_API_KEY_PROD` | Azure OpenAI Gov Cloud key |
| `AZURE_OPENAI_DEPLOYMENT_PROD` | Gov Cloud GPT-4 deployment |

**Note**: Using `_DEV` and `_PROD` suffixes allows seamless environment switching.

---

## Part 9: Verify Configuration

### Step 14: Test Secrets Existence

1. Start the application: `npm run dev`
2. Check server logs for secret validation
3. Look for startup validator output:
   ```
   ✅ All required secrets configured for DEV environment
   ⚠️  Production secrets not yet configured (expected for dev)
   ```

### Step 15: Test Microsoft Graph API Access

**Using Graph Explorer** (https://developer.microsoft.com/graph/graph-explorer):

1. Sign in with your Azure AD account
2. Consent to permissions for Graph Explorer
3. Test queries:
   - **User profile**: `GET https://graph.microsoft.com/v1.0/me`
   - **Group memberships**: `GET https://graph.microsoft.com/v1.0/me/memberOf`
   - **Online meetings**: `GET https://graph.microsoft.com/v1.0/me/onlineMeetings`
   - **SharePoint site**: `GET https://graph.microsoft.com/v1.0/sites/{site-id}`

**Expected Results**: All queries should return successful responses (200 OK)

### Step 16: Test Azure OpenAI Access

**Using curl or Postman**:

```bash
curl https://YOUR-ENDPOINT.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-02-15-preview \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR-API-KEY" \
  -d '{
    "messages": [{"role": "user", "content": "Test message"}],
    "max_tokens": 10
  }'
```

**Expected Result**: JSON response with generated text

---

## Part 10: Configure Azure AD Security Groups (Optional - for Access Control)

### Step 17: Create DOD Security Groups

Create the following security groups in Azure AD for access control:

**Clearance-Level Groups**:

1. Navigate to **Azure AD** > **Groups** > **New group**
2. Create each group:

| Group Name | Type | Description |
|-----------|------|-------------|
| `DOD-Clearance-UNCLASSIFIED` | Security | Users with UNCLASSIFIED clearance |
| `DOD-Clearance-CONFIDENTIAL` | Security | Users with CONFIDENTIAL clearance |
| `DOD-Clearance-SECRET` | Security | Users with SECRET clearance |
| `DOD-Clearance-TOP_SECRET` | Security | Users with TOP SECRET clearance |

**Role Groups**:

| Group Name | Type | Description |
|-----------|------|-------------|
| `DOD-Role-Viewer` | Security | Default role - can view attended meetings |
| `DOD-Role-Approver` | Security | Can approve/reject meeting minutes |
| `DOD-Role-Auditor` | Security | Can view entire archive (within clearance) |
| `DOD-Role-Admin` | Security | Full system access + user management |

### Step 18: Assign Users to Groups

1. For each group, click **Members** > **Add members**
2. Search and add appropriate users
3. Click **Select**

**Note**: Group membership will be synced automatically by the application via Graph API

---

## Troubleshooting

### Common Issues

**Issue**: "Insufficient privileges to complete the operation"
- **Solution**: Ensure admin consent was granted (Step 5)
- Verify you have Global Administrator or Application Administrator role

**Issue**: "Invalid client secret"
- **Solution**: Secret may have expired - generate new secret (Step 7)
- Ensure secret was copied immediately (secrets are only shown once)

**Issue**: "Resource not found" for SharePoint site
- **Solution**: Verify site URL is correct
- Ensure `Sites.Selected` permission has been granted to specific site (Step 8)

**Issue**: Azure OpenAI returns 401 Unauthorized
- **Solution**: Check API key is correct
- Verify endpoint URL includes your resource name
- Ensure deployment exists and is in "Succeeded" state

**Issue**: Graph API returns "Unauthorized"
- **Solution**: Check token has correct scopes
- Verify application permissions were granted admin consent
- Ensure client secret is valid and not expired

---

## Security Best Practices

1. **Rotate secrets regularly**: Set expiration to 12-24 months, not "Never expires"
2. **Use least privilege**: Only grant permissions actually needed
3. **Separate dev/prod**: Use different app registrations for development vs production
4. **Monitor access**: Review Azure AD sign-in logs regularly
5. **Enable MFA**: Require multi-factor authentication for all admin accounts
6. **Audit permissions**: Regularly review and remove unused permissions

---

## Next Steps

After completing this setup:

1. ✅ All Azure AD app registrations complete
2. ✅ API permissions granted and consented
3. ✅ Client secrets stored in Replit
4. ✅ Azure OpenAI service deployed
5. ✅ SharePoint connector configured
6. ✅ Security groups created (optional)

**Proceed to**: Task 2 - Implement Teams SSO authentication middleware

---

## Appendix: Quick Reference

### Required Azure AD Permissions

**Delegated**:
- User.Read
- OnlineMeetings.Read
- Group.Read.All
- Mail.Send

**Application**:
- User.Read.All
- Group.Read.All
- OnlineMeetings.Read.All
- Calendars.Read
- Mail.Send
- Sites.Selected (or Files.Read.All)

### Required Replit Secrets (Development)

```
GRAPH_TENANT_ID_DEV=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
GRAPH_CLIENT_ID_DEV=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
GRAPH_CLIENT_SECRET_DEV=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_OPENAI_ENDPOINT_DEV=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY_DEV=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_OPENAI_DEPLOYMENT_DEV=gpt-4
SHAREPOINT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SHAREPOINT_SITE_URL=https://yourorg.sharepoint.com/sites/meetings
SHAREPOINT_LIBRARY=Meeting Minutes
```

### Useful Links

- Azure Portal: https://portal.azure.com
- Azure Government Portal: https://portal.azure.us
- Graph Explorer: https://developer.microsoft.com/graph/graph-explorer
- Graph API Documentation: https://learn.microsoft.com/graph
- Azure OpenAI Documentation: https://learn.microsoft.com/azure/ai-services/openai
- Teams App Development: https://learn.microsoft.com/microsoftteams/platform

---

**Document Version**: 1.0  
**Last Updated**: November 2025  
**Maintained By**: Solution Architecture Team
