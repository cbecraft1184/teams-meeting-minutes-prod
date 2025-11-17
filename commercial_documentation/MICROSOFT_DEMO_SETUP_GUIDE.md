# Microsoft Teams Demo Environment Setup Guide
## Complete Instructions for 10-Person Pre-Scripted Meeting Demo

---

## Overview

This guide walks you through setting up a Microsoft Teams environment to demo your Meeting Minutes Management application with 10 users. You'll create a free Microsoft 365 Developer tenant with pre-configured users and deploy your Teams app.

**Time to complete:** 30-60 minutes  
**Cost:** FREE (90-day renewable subscription)

---

## Part 1: Create Microsoft 365 Developer Tenant (FREE)

### Step 1.1: Join the Microsoft 365 Developer Program

1. **Go to:** https://developer.microsoft.com/microsoft-365/dev-program

2. **Click "Sign in"** (top right)
   - Use your personal Microsoft account (Outlook.com, Hotmail.com, etc.)
   - Don't have one? Click "Create one!" to sign up

3. **Click "Join now"**

4. **Fill out the registration form:**
   - **Country/Region:** Select your country
   - **Company:** Enter your organization name (or "Demo" if personal)
   - **Language:** English (United States)
   - Check: "I accept the terms and conditions"
   - Optional: Check "I would like information, tips, and offers about Microsoft 365 and other Microsoft products and services"
   - Click **"Next"**

5. **Set your preferences:**
   - Select relevant options (any choices work, this is just for Microsoft's analytics)
   - **Focus areas to build:** Microsoft Teams apps
   - **Products I'm interested in:** Microsoft Teams, Microsoft Graph
   - Click **"Join"**

✅ **Result:** You're now enrolled in the Microsoft 365 Developer Program!

---

### Step 1.2: Set Up Your Developer Sandbox

You'll now create your isolated Microsoft 365 environment with 10+ users.

1. **On the "Set up E5 subscription" page, choose:**
   - **Instant Sandbox** (RECOMMENDED)
   - This gives you 24 pre-configured test users + 1 admin
   - Setup completes in seconds

   ![Choose Instant Sandbox]

2. **Select your Country/Region** (required for data residency)

3. **Create your admin account:**
   - **Username:** Choose your admin username (e.g., `admin`)
   - **Domain:** You'll get `yourcompany.onmicrosoft.com` (auto-generated)
   - **Password:** Create a strong password (save this - you'll need it!)
   
   Example:
   ```
   Username: admin
   Email: admin@contoso123456.onmicrosoft.com
   Password: [Your secure password]
   ```

4. **Phone verification:**
   - Enter your mobile phone number
   - Click **"Send Code"**
   - Enter the SMS code you receive
   - Click **"Set up"**

5. **Wait for provisioning** (usually 30-60 seconds)

✅ **Result:** Your Microsoft 365 tenant is ready! You'll see:
- **Tenant name:** `contoso123456.onmicrosoft.com` (your unique domain)
- **Admin username:** `admin@contoso123456.onmicrosoft.com`
- **25 E5 licenses** available
- **24 sample users** already created

---

### Step 1.3: Access Your New Environment

1. **Click "Go to subscription"** on the success page

2. You'll be taken to your **Developer Dashboard** showing:
   - Subscription status: Active
   - Expiration date: 90 days from today
   - Your tenant domain

3. **Save these credentials securely:**
   ```
   Tenant Domain: [yourcompany].onmicrosoft.com
   Admin Email: admin@[yourcompany].onmicrosoft.com
   Admin Password: [your password]
   ```

---

## Part 2: Configure Your 10 Demo Users

Your Instant Sandbox comes with 24 pre-configured users. You'll select 10 for your demo.

### Step 2.1: Access Microsoft 365 Admin Center

1. **Go to:** https://admin.microsoft.com

2. **Sign in with your admin credentials:**
   - Email: `admin@[yourcompany].onmicrosoft.com`
   - Password: [your admin password]

3. **Multi-Factor Authentication (MFA) Setup:**
   - If prompted, set up MFA using your phone
   - This adds security to your admin account

---

### Step 2.2: View Your Pre-Created Users

1. In the **Microsoft 365 Admin Center**, navigate to:
   - **Users** → **Active users** (left sidebar)

2. **You'll see 24 sample users** including:
   - Adele Vance
   - Alex Wilber
   - Allan Deyoung
   - Bianca Pisani
   - Brian Johnson (Facilities Manager)
   - Christie Cline
   - Debra Berger
   - Diego Siciliani
   - Emily Braun
   - Grady Archie
   - Henrietta Mueller
   - Isaiah Langer
   - Johanna Lorenz
   - Joni Sherman
   - Lee Gu
   - Lidia Holloway
   - Lynne Robbins
   - Megan Bowen
   - Miriam Graham
   - Nestor Wilke
   - Patti Fernandez
   - Pradeep Gupta
   - Raul Razo
   - Sheldon Hull

---

### Step 2.3: Select and Configure 10 Users for Your Demo

**Recommended 10 users for meeting demo:**

1. **Adele Vance** (Retail Manager) - Meeting organizer
2. **Megan Bowen** (Auditor) - Approver
3. **Alex Wilber** (Marketing Assistant)
4. **Joni Sherman** (Photographer)
5. **Lynne Robbins** (Account Executive)
6. **Patti Fernandez** (Security Reader)
7. **Pradeep Gupta** (Attorney)
8. **Isaiah Langer** (Developer)
9. **Miriam Graham** (Software Engineer)
10. **Nestor Wilke** (Operations Manager)

**All users already have:**
- ✅ Microsoft 365 E5 licenses assigned
- ✅ Microsoft Teams access enabled
- ✅ Email addresses (@yourcompany.onmicrosoft.com)
- ✅ Default passwords (you can reset if needed)

---

### Step 2.4: Get User Passwords (Optional - For Demo Login)

**Option A: Use Default Passwords**
The sample users have default passwords. To view them:
1. Click on a user (e.g., Adele Vance)
2. Click **"Reset password"** tab
3. Choose: "Let me create the password"
4. Set a simple demo password (e.g., `Demo2025!`)
5. Uncheck "Require this user to change their password..."
6. Click **"Reset password"**

**Option B: Use Auto-Generated Passwords**
1. Click on a user
2. Click **"Reset password"**
3. Choose "Automatically create a password"
4. Check "Email the new password to me"
5. You'll receive the password via email

**Repeat for all 10 users** so you can log in as them during the demo.

---

### Step 2.5: Verify Teams Licenses

1. **Select one of your 10 users** (e.g., Adele Vance)

2. **Click on the user's name**

3. **Go to "Licenses and apps" tab**

4. **Verify the following are checked:**
   - ✅ Microsoft 365 E5 Developer (without Windows and Audio Conferencing)
   - Under "Apps":
     - ✅ **Microsoft Teams** (this is what you need!)
     - ✅ Exchange Online
     - ✅ SharePoint Online
     - ✅ Office for the Web

5. **If Microsoft Teams is not enabled:**
   - Check the box next to "Microsoft Teams"
   - Click **"Save changes"**

6. **Repeat for all 10 users** (or verify they all have Teams enabled)

✅ **Result:** All 10 users can now access Microsoft Teams!

---

## Part 3: Enable Teams App Sideloading

To upload your custom Teams app, you must enable sideloading in your tenant.

### Step 3.1: Access Teams Admin Center

1. **Go to:** https://admin.teams.microsoft.com

2. **Sign in** with your admin account

3. You may need to wait 5-10 minutes if this is a brand new tenant (backend services are still provisioning)

---

### Step 3.2: Enable Custom App Uploads

1. **Navigate to:** Teams apps → **Setup policies** (left sidebar)

2. **Click on "Global (Org-wide default)"** policy

3. **Under "Custom apps" section:**
   - Toggle **"Upload custom apps"** to **ON** ✅

4. **Click "Save"** at the bottom

5. **Wait 5-10 minutes** for the policy to propagate to all users

✅ **Result:** All users in your tenant can now upload custom Teams apps!

---

## Part 4: Create Your Teams App Package

Now you'll create the `.zip` package that installs your app in Teams.

### Step 4.1: Prepare Required Files

You need 3 files to create a Teams app package:

1. **manifest.json** - App configuration
2. **icon-color.png** - Color icon (192x192 pixels)
3. **icon-outline.png** - Outline icon (32x32 pixels)

---

### Step 4.2: Create manifest.json

Create a file named `manifest.json` with this content:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
  "manifestVersion": "1.17",
  "version": "1.0.0",
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "packageName": "com.yourcompany.meetingminutes",
  "developer": {
    "name": "Your Company Name",
    "websiteUrl": "https://www.yourcompany.com",
    "privacyUrl": "https://www.yourcompany.com/privacy",
    "termsOfUseUrl": "https://www.yourcompany.com/terms"
  },
  "name": {
    "short": "Meeting Minutes",
    "full": "Enterprise Teams Meeting Minutes Management"
  },
  "description": {
    "short": "AI-powered meeting minutes",
    "full": "Automatically capture, process, and distribute Microsoft Teams meeting minutes with AI-generated summaries and action items."
  },
  "icons": {
    "outline": "icon-outline.png",
    "color": "icon-color.png"
  },
  "accentColor": "#0078D4",
  "staticTabs": [
    {
      "entityId": "meeting-minutes-dashboard",
      "name": "Minutes",
      "contentUrl": "https://YOUR-REPLIT-URL.replit.dev/",
      "websiteUrl": "https://YOUR-REPLIT-URL.replit.dev/",
      "scopes": ["personal"]
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "YOUR-REPLIT-URL.replit.dev"
  ]
}
```

**IMPORTANT CHANGES:**

1. **Generate a unique ID:**
   - Go to https://www.uuidgenercertificationr.net/
   - Copy the generated UUID
   - Replace `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` with your UUID

2. **Replace YOUR-REPLIT-URL:**
   - Find your Replit app URL (e.g., `my-app.username.replit.dev`)
   - Replace `YOUR-REPLIT-URL.replit.dev` in **3 places**:
     - Line with `contentUrl`
     - Line with `websiteUrl`
     - Line with `validDomains`

Example after replacement:
```json
"contentUrl": "https://meeting-minutes-demo.johndoe.replit.dev/",
"websiteUrl": "https://meeting-minutes-demo.johndoe.replit.dev/",
"validDomains": [
  "meeting-minutes-demo.johndoe.replit.dev"
]
```

---

### Step 4.3: Create App Icons

**Option A: Use Placeholder Icons (Quick)**

1. **Create a simple color icon (192x192):**
   - Use any online tool like https://www.canva.com
   - Create 192x192 image with blue background
   - Add white text: "MM" (for Meeting Minutes)
   - Save as `icon-color.png`

2. **Create outline icon (32x32):**
   - Create 32x32 image with transparent background
   - Add white icon/symbol
   - Save as `icon-outline.png`

**Option B: Use Design Tools**
- **Canva**: https://www.canva.com (free templates)
- **Figma**: https://www.figma.com
- **Adobe Express**: https://www.adobe.com/express

**Requirements:**
- `icon-color.png`: 192x192 pixels, PNG format, <25KB
- `icon-outline.png`: 32x32 pixels, PNG format, white/transparent, <25KB

---

### Step 4.4: Create the App Package (.zip)

1. **Create a folder** on your computer named `teams-app`

2. **Place these 3 files** in the folder:
   - `manifest.json`
   - `icon-color.png`
   - `icon-outline.png`

3. **Select all 3 files** (NOT the folder)

4. **Create a ZIP archive:**
   
   **Windows:**
   - Right-click the selected files
   - Send to → Compressed (zipped) folder
   - Name it `meeting-minutes-app.zip`

   **Mac:**
   - Right-click the selected files
   - Compress 3 items
   - Rename to `meeting-minutes-app.zip`

   **Linux:**
   ```bash
   zip meeting-minutes-app.zip manifest.json icon-color.png icon-outline.png
   ```

✅ **Result:** You have `meeting-minutes-app.zip` ready to upload!

---

## Part 5: Upload Teams App to Your Tenant

### Step 5.1: Upload to Teams Admin Center (Org-Wide Deployment)

**Option A: Admin Upload (Makes app available to all users)**

1. **Go to:** https://admin.teams.microsoft.com

2. **Navigate to:** Teams apps → **Manage apps**

3. **Click "Upload"** (or "Upload new app" button)

4. **Select your `meeting-minutes-app.zip`** file

5. **Click "Upload"**

6. **You'll see a success message** and your app appears in the list

7. **Search for "Meeting Minutes"** in the Manage apps list

8. **Verify status is "Allowed"**

✅ **Result:** Your app is now available in your org's app catalog!

---

### Step 5.2: Install the App (As a User)

Now each of your 10 demo users can install the app.

**For each user:**

1. **Open Microsoft Teams:**
   - Go to https://teams.microsoft.com
   - Or use Teams desktop app

2. **Sign in as one of your 10 users**
   - Email: `adele@[yourcompany].onmicrosoft.com`
   - Password: [password you set]

3. **Click "Apps"** in the left sidebar

4. **Click "Built for your org"** (or "Built for [your company]")

5. **You'll see "Meeting Minutes"** app

6. **Click on it** → Click **"Add"**

7. **The app appears in your left sidebar!**

✅ **Result:** User can now access the Meeting Minutes app from Teams!

---

### Step 5.3: Alternative - Sideload Directly (Skip Admin Upload)

If you want users to upload the app themselves:

1. **Send `meeting-minutes-app.zip`** to your 10 demo users

2. **Each user:**
   - Opens Teams
   - Clicks **"Apps"** → **"Manage your apps"**
   - Clicks **"Upload an app"** → **"Upload a custom app"**
   - Selects the `.zip` file
   - Clicks **"Add"**

---

## Part 6: Verify Everything Works

### Step 6.1: Test as a User

1. **Sign in to Teams** as Adele Vance (or any of your 10 users)

2. **Click "Meeting Minutes"** icon in the left sidebar

3. **Your web app loads** in the Teams iframe!

4. **You should see:**
   - Your React app dashboard
   - Mock login page (if using mock auth)
   - List of meetings

---

### Step 6.2: Schedule Your Demo Meeting

1. **In Teams, click "Calendar"**

2. **Click "New meeting"**

3. **Fill in details:**
   - **Title:** Q4 Planning Meeting (or your pre-scripted meeting name)
   - **Add all 10 users** as required attendees
   - **Date/Time:** Choose your demo date
   - Click **"Save"**

4. **Meeting appears** in everyone's calendar

---

### Step 6.3: Conduct Your Demo

**During/After the meeting:**

1. **Users click "Meeting Minutes"** in Teams sidebar

2. **App displays the pre-scripted meeting** (from your seeded demo data)

3. **Demo the workflow:**
   - View AI-generated minutes
   - Approve/reject minutes
   - Download DOCX/PDF
   - View action items
   - See email distribution (mocked)

---

## Part 7: Troubleshooting

### Problem: "Upload custom apps" option is greyed out

**Solution:**
- Wait 10-15 minutes after creating your tenant
- Backend services may still be provisioning
- Try signing out and back in to Teams Admin Center

---

### Problem: App doesn't appear in "Built for your org"

**Solution:**
- Verify you uploaded to **Teams Admin Center** → Manage apps
- Check app status is "Allowed" (not "Blocked")
- Wait 5-10 minutes for app catalog to refresh
- Have user sign out and back in to Teams

---

### Problem: Users can't see the app

**Solution:**
- Verify "Upload custom apps" is enabled in Setup policies
- Check users are assigned to the Global policy (or custom policy with upload enabled)
- Verify users have Teams licenses assigned

---

### Problem: App loads blank page in Teams

**Solution:**
- Verify your Replit app is running (green "Running" status)
- Check the URL in manifest.json matches your Replit URL exactly
- Ensure your app is accessible via HTTPS
- Check browser console for errors (F12 in Teams desktop app)

---

### Problem: "This app can't be added"

**Solution:**
- Verify manifest.json syntax is valid (use https://jsonlint.com)
- Check all required fields are filled
- Verify icon files are correct size and format
- Ensure validDomains matches your contentUrl domain

---

## Part 8: Demo Day Checklist

**1 Day Before:**
- [ ] Verify all 10 users can sign in to Teams
- [ ] Confirm Meeting Minutes app is installed for all users
- [ ] Test the app loads correctly in Teams sidebar
- [ ] Verify your Replit app is running
- [ ] Seed your demo data (6 meetings with various classifications)
- [ ] Schedule the demo meeting in Teams calendar

**2 Hours Before:**
- [ ] Have all user credentials ready
- [ ] Test login as 2-3 different users
- [ ] Verify meeting appears in the app
- [ ] Check approval workflow works
- [ ] Test DOCX/PDF downloads
- [ ] Prepare script for demo flow

**During Demo:**
- [ ] Show app in Teams sidebar (easy access)
- [ ] Navigate to completed meeting
- [ ] Display AI-generated minutes
- [ ] Demonstrate approval workflow
- [ ] Show classification badges (Standard, etc.)
- [ ] Demo action items extraction
- [ ] Show email distribution notification
- [ ] Download and display DOCX/PDF output

---

## Summary: What You've Created

✅ **Microsoft 365 Tenant** (yourcompany.onmicrosoft.com)  
✅ **25 E5 Licenses** (24 users + 1 admin)  
✅ **10 Demo Users** with Teams access  
✅ **Teams App Package** (manifest + icons)  
✅ **Custom Teams App** deployed org-wide  
✅ **Pre-Scripted Meeting** scheduled  
✅ **Demo Environment** ready to present  

**Cost:** $0 (FREE for 90 days, renewable)  
**Time invested:** 30-60 minutes  
**Users ready:** 10  
**Deployment:** Production-like Teams environment  

---

## Next Steps After Demo

**If demo is successful:**
1. Begin Azure AD app registration for SSO
2. Request Microsoft Graph API permissions
3. Integrate with real Teams meetings (webhooks)
4. Connect to SharePoint for archival
5. Plan for production deployment

**Renew your developer subscription:**
- Keep building/testing in your sandbox
- Subscription auto-renews every 90 days if you're actively developing
- Check renewal status: https://developer.microsoft.com/microsoft-365/profile

---

## Support Resources

- **Microsoft 365 Developer Program:** https://developer.microsoft.com/microsoft-365/dev-program
- **Teams App Documentation:** https://learn.microsoft.com/microsoftteams/platform/
- **Teams Admin Center:** https://admin.teams.microsoft.com
- **Microsoft 365 Admin Center:** https://admin.microsoft.com
- **Developer Support:** https://developer.microsoft.com/microsoft-365/support

---

**You're all set for your 10-person demo! 🎉**

This environment gives you a production-like Microsoft Teams instance completely free, perfect for demonstrating your Meeting Minutes Management system to stakeholders.
