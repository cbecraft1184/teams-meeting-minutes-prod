# Quick Start Guide

Get up and running with Teams Meeting Minutes in 15 minutes.

---

## Prerequisites

Before you begin, ensure you have:

- [ ] Azure subscription with Contributor access
- [ ] Microsoft 365 tenant with Global Admin access
- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] Azure CLI installed

---

## Step 1: Clone and Install (2 minutes)

```bash
git clone https://github.com/your-org/teams-meeting-minutes.git
cd teams-meeting-minutes
npm install
```

---

## Step 2: Create Azure Resources (5 minutes)

```bash
# Login to Azure
az login

# Create resource group
az group create --name rg-teams-minutes --location eastus2

# Create PostgreSQL database
az postgres flexible-server create \
  --resource-group rg-teams-minutes \
  --name teams-minutes-db \
  --location eastus2 \
  --admin-user adminuser \
  --admin-password 'SecurePassword123!' \
  --sku-name Standard_B1ms \
  --tier Burstable

# Note your connection string
az postgres flexible-server show-connection-string \
  --server-name teams-minutes-db
```

---

## Step 3: Register Azure AD App (5 minutes)

1. Go to **Azure Portal** → **Azure Active Directory** → **App registrations**
2. Click **New registration**
3. Enter name: `Teams Meeting Minutes`
4. Set redirect URI: `https://your-app-url/auth/callback`
5. Click **Register**

Note the following values:
- **Application (client) ID**
- **Directory (tenant) ID**

6. Go to **Certificates & secrets** → **New client secret**
7. Note the **secret value**

8. Go to **API permissions** and add:
   - Microsoft Graph → User.Read (Delegated)
   - Microsoft Graph → Calendars.Read (Delegated)
   - Microsoft Graph → CallRecords.Read.All (Application)

9. Click **Grant admin consent**

---

## Step 4: Configure Environment (2 minutes)

Create `.env` file:

```bash
cp .env.example .env
```

Edit with your values:

```env
DATABASE_URL=postgresql://adminuser:SecurePassword123!@teams-minutes-db.postgres.database.azure.com:5432/postgres?sslmode=require
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com
AZURE_OPENAI_API_KEY=your-openai-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
SESSION_SECRET=random-32-character-string
```

---

## Step 5: Start the Application (1 minute)

```bash
# Push database schema
npm run db:push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

---

## Step 6: Verify Installation

Open your browser and check:

1. **Health check**: `http://localhost:5000/health` → Should return `OK`
2. **Dashboard**: `http://localhost:5000` → Should show login page

---

## Next Steps

- [Full Admin Installation Guide](ADMIN_INSTALLATION_GUIDE.md) - Detailed setup instructions
- [User Guide](USER_GUIDE.md) - How to use the application
- [Teams App Deployment](ADMIN_INSTALLATION_GUIDE.md#teams-app-deployment) - Deploy to Teams

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Database connection fails | Check DATABASE_URL format and firewall rules |
| Authentication errors | Verify Azure AD app settings and admin consent |
| 500 errors | Check logs with `npm run dev` for details |

For detailed troubleshooting, see [Admin Installation Guide](ADMIN_INSTALLATION_GUIDE.md#troubleshooting).

---

*Quick Start Version 1.0 | December 2025*
