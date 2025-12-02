# Azure Deployment Checklist

Complete this checklist before every deployment to prevent failures.

## 1. Pre-Commit Security

Before committing ANY code:

- [ ] Never paste credentials, API keys, or secrets into any file
- [ ] Check `attached_assets/` folder for sensitive content - delete any logs with credentials
- [ ] Add sensitive file patterns to `.gitignore`

### Files to Never Commit
- Azure Portal output/logs
- Screenshots with credentials visible
- Environment files (.env, .env.local)
- Any file containing `clientSecret`, `API_KEY`, or similar

---

## 2. Azure Service Principal Setup

Your app registration: **Teams Minutes Graph API**
- Client ID: `71383692-c5c6-40cc-94cf-96c97fed146c`
- Tenant ID: `e4be879d-b4b5-4eb7-bdb8-70b31519d985`

### Required Role Assignment

The service principal MUST have **Contributor** role on the subscription:

1. Azure Portal → Subscriptions → Azure subscription 1
2. Access control (IAM) → Add → Add role assignment
3. **Privileged administrator roles** tab (not Job function roles)
4. Select **Contributor**
5. Members → Select "Teams Minutes Graph API"
6. Review + assign

### Verify Role Assignment
```bash
az role assignment list --assignee 71383692-c5c6-40cc-94cf-96c97fed146c --output table
```

---

## 3. GitHub Repository Secrets

Go to: Repository → Settings → Secrets and variables → Actions

### Required Secret

| Secret Name | Format | Description |
|------------|--------|-------------|
| `AZURE_CREDENTIALS` | JSON | Single combined credential |

### AZURE_CREDENTIALS Format
```json
{
  "clientId": "71383692-c5c6-40cc-94cf-96c97fed146c",
  "clientSecret": "YOUR_CLIENT_SECRET_VALUE",
  "subscriptionId": "17f080ac-db85-4c7d-a12e-fc88bf22b2bc",
  "tenantId": "e4be879d-b4b5-4eb7-bdb8-70b31519d985"
}
```

**Important:** Paste as a single line with no extra spaces.

---

## 4. Pre-Deployment Verification

Before pushing to main:

- [ ] Service principal has Contributor role on subscription
- [ ] `AZURE_CREDENTIALS` secret exists in GitHub with correct JSON format
- [ ] No secrets in commit history (check with `git log -p | grep -i secret`)
- [ ] Workflow file references `secrets.AZURE_CREDENTIALS`

---

## 5. Post-Deployment Verification

After successful deployment:

- [ ] App URL responds: https://teams-minutes-app.orangemushroom-b6a1517d.eastus2.azurecontainerapps.io
- [ ] Health endpoint works: /health
- [ ] Check Azure Container Apps logs for errors

---

## 6. Secret Rotation Schedule

Rotate these credentials every 90 days:

| Credential | Location | Last Rotated |
|-----------|----------|--------------|
| Azure AD Client Secret | Azure Portal → App Registrations → Certificates & secrets | December 2, 2025 |
| Azure OpenAI API Key | Azure Portal → OpenAI Resource → Keys | TBD |

After rotation:
1. Update `AZURE_CREDENTIALS` in GitHub Secrets
2. Update secrets in Replit environment
3. Re-run deployment workflow

---

## 7. Troubleshooting

### "No subscriptions found"
→ Service principal missing Contributor role. See Section 2.

### "client-id and tenant-id not supplied"
→ Wrong secret format. Use single `AZURE_CREDENTIALS` JSON. See Section 3.

### Push blocked by GitHub
→ Secrets detected in files. Remove sensitive content and use `git filter-branch` or BFG to clean history.

### Contributor role not visible
→ Look under **"Privileged administrator roles"** tab, not "Job function roles".
