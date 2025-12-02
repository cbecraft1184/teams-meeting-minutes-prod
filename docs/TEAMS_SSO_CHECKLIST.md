# Teams SSO Configuration Checklist

## Azure AD App Registration Settings

**App Registration:** Teams Minutes Graph API  
**Client ID:** `71383692-c5c6-40cc-94cf-96c97fed146c`

### 1. Expose an API (Required for SSO)

Go to: Azure Portal → App registrations → Teams Minutes Graph API → Expose an API

**Application ID URI** (set at the top):
```
api://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/71383692-c5c6-40cc-94cf-96c97fed146c
```

**Scope** (must exist under "Scopes defined by this API"):
- Scope name: `access_as_user`
- Who can consent: Admins and users
- Admin consent display name: Access Meeting Minutes
- Admin consent description: Allows the app to access Meeting Minutes on behalf of the signed-in user
- State: Enabled

### 2. Authorized Client Applications

Under "Authorized client applications", add BOTH of these Teams client IDs:

| Client ID | Description |
|-----------|-------------|
| `1fec8e78-bce4-4aaf-ab1b-5451cc387264` | Teams desktop/mobile |
| `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` | Teams web |

For each, authorize the `access_as_user` scope.

### 3. API Permissions

Go to: API permissions

**Microsoft Graph (Delegated):**
- User.Read
- Calendars.Read
- OnlineMeetings.Read
- CallRecords.Read.All (Application - needs admin consent)

### 4. Authentication

Go to: Authentication

**Redirect URIs:**
- `https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io/auth/callback`

**Implicit grant:**
- Access tokens: Checked
- ID tokens: Checked

### 5. Admin Consent

Go to: API permissions → Click "Grant admin consent for [Your Tenant]"

---

## Verification Steps

1. Open the app in Teams
2. Open browser Developer Tools (F12)
3. Go to Console tab
4. Look for `[AUTH` log entries
5. If you see `TEAMS_SDK_ERROR`, the SDK isn't initializing
6. If you see `SSO_TOKEN_SUCCESS`, SSO is working

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| AADSTS500011 | Application ID URI mismatch | Set URI exactly as shown above |
| AADSTS65001 | Admin consent not granted | Grant admin consent in Azure AD |
| AADSTS700016 | App not found in tenant | Verify Client ID matches |
| SDK timeout | App not loaded in Teams context | Must open app inside Teams |
