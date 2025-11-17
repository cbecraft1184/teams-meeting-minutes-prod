# CAC/PIV Configuration Baselines - DOD Meeting Minutes Management System

**Document Version:** 1.0  
**Last Updated:** 2025-11-14  
**Classification:** UNCLASSIFIED  
**Deployment Target:** Azure Commercial ONLY

---

## Executive Summary

This document defines the **Common Access Card (CAC) and Personal Identity Verification (PIV) authentication configuration** for the DOD Meeting Minutes Management System. CAC/PIV enforcement ensures strong, cryptographic-based authentication for all users accessing the system, meeting DOD IA requirements for IL5/SECRET information systems.

**Key Requirements:**
- **CAC/PIV Mandatory:** All users must authenticate using CAC/PIV certificates
- **Certificate-Based Authentication:** X.509 certificates issued by DOD PKI
- **Azure AD Integration:** Certificate trust via Azure AD federated authentication
- **Conditional Access:** Block non-CAC/PIV authentication methods
- **Device Compliance:** Enforce DOD-approved devices with compliant middleware

---

## Table of Contents

1. [CAC/PIV Overview](#cacpiv-overview)
2. [Azure AD Configuration](#azure-ad-configuration)
3. [Conditional Access Policies](#conditional-access-policies)
4. [Certificate Trust Configuration](#certificate-trust-configuration)
5. [Device Compliance Requirements](#device-compliance-requirements)
6. [Testing and Validation](#testing-and-validation)
7. [Troubleshooting](#troubleshooting)

---

## 1. CAC/PIV Overview

### 1.1 Authentication Flow

```
User inserts CAC → Browser detects smart card → Certificate selection → 
Azure AD validates certificate → Claims extraction → Token issuance → Application access
```

### 1.2 Supported Certificates

**DOD CAC Certificates:**
- **Authentication Certificate:** Used for user authentication
- **Email Certificate:** Used for S/MIME (not for authentication)
- **Signature Certificate:** Used for digital signatures (not for authentication)

**PIV Certificates:**
- **PIV Authentication Certificate:** Primary authentication certificate
- **Card Authentication Certificate:** Device authentication (not user)

**Certificate Requirements:**
- Issued by DOD PKI (DOD Root CA 3 or DOD Root CA 6)
- Valid (not expired, not revoked)
- Subject Alternative Name (SAN) contains user UPN matching Azure AD
- Key usage includes "Digital Signature" and "Key Encipherment"

### 1.3 PKI Hierarchy

```
DOD Root CA 3
  ├── DOD Issuing CA (Production)
  │     └── User CAC Certificate (Authentication)
  └── DOD Issuing CA (Test)
        └── User CAC Certificate (Development/Test)
```

---

## 2. Azure AD Configuration

### 2.1 Certificate-Based Authentication Setup

**Prerequisites:**
- Azure AD Premium P1 or P2 license
- Global Administrator access
- DOD Root CA certificates (PEM format)

**Configuration Steps:**

**Step 1: Upload Trusted Root Certificates**

```powershell
# Connect to Azure AD (GCC High)
Connect-AzureAD -AzureEnvironmentName AzureUSGovernment

# Upload DOD Root CA 3
$rootCA = Get-Content -Path "C:\Certs\DOD_ROOT_CA_3.cer" -Encoding Byte
New-AzureADTrustedCertificateAuthority `
  -CertificateAuthorityInformation $rootCA `
  -IsRootAuthority $true

# Upload DOD Issuing CA (Production)
$issuingCA = Get-Content -Path "C:\Certs\DOD_ISSUING_CA_PROD.cer" -Encoding Byte
New-AzureADTrustedCertificateAuthority `
  -CertificateAuthorityInformation $issuingCA `
  -IsRootAuthority $false
```

**Step 2: Configure Certificate Authority Preferences**

```powershell
# Set certificate revocation list (CRL) checking
Set-AzureADCertificateBasedAuthConfiguration `
  -CertificateAuthorities @(
    @{
      Thumbprint = "THUMBPRINT_OF_DOD_ROOT_CA_3"
      IsRootAuthority = $true
      DeltaCrlDistributionPoint = "http://crl.disa.mil/crl/DODROOTCA3.crl"
      CrlDistributionPoint = "http://crl.disa.mil/crl/DODROOTCA3.crl"
    },
    @{
      Thumbprint = "THUMBPRINT_OF_DOD_ISSUING_CA"
      IsRootAuthority = $false
      DeltaCrlDistributionPoint = "http://crl.disa.mil/crl/DODISSUINGCA.crl"
      CrlDistributionPoint = "http://crl.disa.mil/crl/DODISSUINGCA.crl"
    }
  )
```

**Step 3: Enable Certificate-Based Authentication**

```powershell
# Enable CBA for the tenant
Set-MsolDomainFederationSettings `
  -DomainName "dod.mil" `
  -PreferredAuthenticationProtocol WsFed `
  -SupportsCba $true `
  -PromptLoginBehavior NativeSupport
```

### 2.2 User Principal Name (UPN) Mapping

**Certificate Field Mapping:**
- **Primary:** Subject Alternative Name (SAN) - Principal Name extension
- **Fallback:** Subject DN - Email attribute

**Example Certificate SAN:**
```
Subject Alternative Name:
  Principal Name=john.doe@dod.mil
  RFC822 Name=john.doe@dod.mil
```

**Azure AD UPN:**
```
UserPrincipalName: john.doe@dod.mil
```

**PowerShell Verification:**
```powershell
# Verify UPN mapping for test user
Get-AzureADUser -ObjectId "john.doe@dod.mil" | Select UserPrincipalName, Mail
```

### 2.3 Multi-Factor Authentication (MFA) Configuration

**Requirement:** CAC/PIV + PIN = Two-Factor Authentication

**Azure AD Configuration:**
```powershell
# CAC/PIV counts as MFA (certificate + PIN)
$mfaSettings = @{
  State = "Enabled"
  RememberDevicesNotIssuedBefore = (Get-Date).AddDays(-30)
  UserSettings = @{
    AllowPhoneAppNotifications = $false  # Disable soft tokens
    AllowPhoneAppOTP = $false             # Disable TOTP
    AllowSMS = $false                     # Disable SMS
  }
}

Set-MsolUser -UserPrincipalName "john.doe@dod.mil" -StrongAuthenticationMethods @()
```

**Result:** Users authenticate with CAC/PIV only (no additional MFA prompts)

---

## 3. Conditional Access Policies

### 3.1 Policy 1: Require CAC/PIV for All Users

**Policy Configuration:**

```json
{
  "displayName": "POLICY-001: Require CAC/PIV Authentication",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": ["emergency-access-account@dod.mil"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "clientAppTypes": ["browser", "mobileAppsAndDesktopClients"],
    "locations": {
      "includeLocations": ["All"]
    }
  },
  "grantControls": {
    "operator": "AND",
    "builtInControls": ["certificateBasedAuthentication"],
    "customAuthenticationFactors": [],
    "termsOfUse": []
  },
  "sessionControls": {
    "signInFrequency": {
      "value": 8,
      "type": "hours",
      "isEnabled": true
    },
    "persistentBrowser": {
      "mode": "never",
      "isEnabled": true
    }
  }
}
```

**PowerShell Implementation:**

```powershell
# Create Conditional Access Policy for CAC/PIV
$conditions = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessConditionSet
$conditions.Users = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessUserCondition
$conditions.Users.IncludeUsers = "All"
$conditions.Users.ExcludeUsers = @("emergency-access-account@dod.mil")

$conditions.Applications = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessApplicationCondition
$conditions.Applications.IncludeApplications = "All"

$grantControls = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessGrantControls
$grantControls._Operator = "AND"
$grantControls.BuiltInControls = @("certificateBasedAuthentication")

New-AzureADMSConditionalAccessPolicy `
  -DisplayName "POLICY-001: Require CAC/PIV Authentication" `
  -State "Enabled" `
  -Conditions $conditions `
  -GrantControls $grantControls
```

### 3.2 Policy 2: Block Legacy Authentication

**Policy Configuration:**

```json
{
  "displayName": "POLICY-002: Block Legacy Authentication",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "clientAppTypes": [
      "exchangeActiveSync",
      "other"
    ]
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}
```

**PowerShell Implementation:**

```powershell
# Block legacy authentication protocols
$conditions = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessConditionSet
$conditions.Users = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessUserCondition
$conditions.Users.IncludeUsers = "All"

$conditions.Applications = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessApplicationCondition
$conditions.Applications.IncludeApplications = "All"

$conditions.ClientAppTypes = @("exchangeActiveSync", "other")

$grantControls = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessGrantControls
$grantControls._Operator = "OR"
$grantControls.BuiltInControls = @("block")

New-AzureADMSConditionalAccessPolicy `
  -DisplayName "POLICY-002: Block Legacy Authentication" `
  -State "Enabled" `
  -Conditions $conditions `
  -GrantControls $grantControls
```

### 3.3 Policy 3: Require Compliant Device

**Policy Configuration:**

```json
{
  "displayName": "POLICY-003: Require Compliant Device",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "platforms": {
      "includePlatforms": ["windows", "macOS"]
    }
  },
  "grantControls": {
    "operator": "AND",
    "builtInControls": ["compliantDevice", "certificateBasedAuthentication"]
  }
}
```

**PowerShell Implementation:**

```powershell
# Require device compliance + CAC/PIV
$conditions = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessConditionSet
$conditions.Users = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessUserCondition
$conditions.Users.IncludeUsers = "All"

$conditions.Platforms = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessPlatformCondition
$conditions.Platforms.IncludePlatforms = @("windows", "macOS")

$grantControls = New-Object -TypeName Microsoft.Open.MSGraph.Model.ConditionalAccessGrantControls
$grantControls._Operator = "AND"
$grantControls.BuiltInControls = @("compliantDevice", "certificateBasedAuthentication")

New-AzureADMSConditionalAccessPolicy `
  -DisplayName "POLICY-003: Require Compliant Device" `
  -State "Enabled" `
  -Conditions $conditions `
  -GrantControls $grantControls
```

### 3.4 Policy 4: Block Access from Untrusted Locations

**Policy Configuration:**

```json
{
  "displayName": "POLICY-004: Block Non-US Access",
  "state": "enabled",
  "conditions": {
    "users": {
      "includeUsers": ["All"]
    },
    "applications": {
      "includeApplications": ["All"]
    },
    "locations": {
      "includeLocations": ["All"],
      "excludeLocations": ["Trusted-US-Locations", "DOD-VPN-Ranges"]
    }
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"]
  }
}
```

---

## 4. Certificate Trust Configuration

### 4.1 DOD PKI Root Certificates

**Required Certificates:**
- **DOD Root CA 3:** Primary production root
- **DOD Root CA 6:** Backup/alternate root
- **DOD Issuing CAs:** Intermediate certificates

**Certificate Downloads:**
- DOD Cyber Exchange: https://public.cyber.mil/pki-pke/pkipke-document-library/
- Install Certificates: https://militarycac.com/dodcerts.htm

### 4.2 Certificate Revocation Checking

**OCSP Configuration:**

```powershell
# Configure OCSP settings
$ocspConfig = @{
  EnableOCSP = $true
  OCSPResponderURL = "http://ocsp.disa.mil"
  FallbackToCRL = $true
  CRLDistributionPoint = "http://crl.disa.mil/crl/"
  CacheDuration = 3600  # 1 hour
}

Set-AzureADCertificateBasedAuthConfiguration -OCSPConfiguration $ocspConfig
```

**CRL Distribution Points:**
- **DOD Root CA 3 CRL:** http://crl.disa.mil/crl/DODROOTCA3.crl
- **DOD Issuing CA CRL:** http://crl.disa.mil/crl/DODID_ISSUINGCA.crl

### 4.3 Certificate Validation Rules

**Validation Checks:**
1. **Certificate Chain:** Valid chain to DOD Root CA 3 or 6
2. **Expiration:** Certificate must not be expired
3. **Revocation:** Not revoked per OCSP/CRL
4. **Key Usage:** Must include "Digital Signature"
5. **Enhanced Key Usage:** Client Authentication (1.3.6.1.5.5.7.3.2)
6. **UPN Match:** SAN Principal Name matches Azure AD UPN

**Terraform Configuration:**

```hcl
# Azure AD Certificate Authority Trust
resource "azuread_certificate_based_auth_configuration" "dod_pki" {
  certificate_authorities {
    certificate     = filebase64("certs/DOD_ROOT_CA_3.cer")
    is_root_authority = true
    issuer          = "CN=DOD Root CA 3, OU=PKI, OU=DoD, O=U.S. Government, C=US"
    issuer_ski      = "X3+werTUIgY5WYKNm/LigOc2VYI"
  }
  
  certificate_authorities {
    certificate     = filebase64("certs/DOD_ISSUING_CA.cer")
    is_root_authority = false
    issuer          = "CN=DOD ID CA-59, OU=PKI, OU=DoD, O=U.S. Government, C=US"
  }
}
```

---

## 5. Device Compliance Requirements

### 5.1 Intune Device Compliance Policy

**Windows Compliance Policy:**

```json
{
  "displayName": "DOD Windows Device Compliance",
  "description": "Enforce DOD security baseline for Windows devices",
  "platform": "windows10",
  "passwordRequired": true,
  "passwordMinimumLength": 14,
  "passwordMinutesOfInactivityBeforeLock": 15,
  "passwordPreviousPasswordBlockCount": 24,
  "storageRequireEncryption": true,
  "requireHealthyDeviceReport": true,
  "osMinimumVersion": "10.0.19041.0",  # Windows 10 20H1
  "osMaximumVersion": null,
  "bitLockerEnabled": true,
  "secureBootEnabled": true,
  "codeIntegrityEnabled": true,
  "firewallEnabled": true,
  "antivirusEnabled": true,
  "antiSpywareEnabled": true,
  "defenderEnabled": true,
  "defenderVersion": "4.18.2111.5",  # Minimum Defender version
  "signatureOutOfDate": false,
  "rtpEnabled": true,
  "deviceThreatProtectionEnabled": true,
  "deviceThreatProtectionRequiredSecurityLevel": "medium"
}
```

**PowerShell Implementation:**

```powershell
# Create Windows compliance policy
$compliancePolicy = @{
  "@odata.type" = "#microsoft.graph.windows10CompliancePolicy"
  displayName = "DOD Windows Device Compliance"
  passwordRequired = $true
  passwordMinimumLength = 14
  passwordMinutesOfInactivityBeforeLock = 15
  storageRequireEncryption = $true
  bitLockerEnabled = $true
  secureBootEnabled = $true
  firewallEnabled = $true
  antivirusRequired = $true
  defenderEnabled = $true
}

$policy = New-MgDeviceManagementDeviceCompliancePolicy -BodyParameter $compliancePolicy
```

### 5.2 Smart Card Middleware Requirements

**Required Software:**
- **ActivClient 7.x:** DOD-approved smart card middleware (Windows)
- **CACKey 1.x:** CAC support for macOS
- **OpenSC:** Open-source alternative (Linux)

**Browser Configuration:**

**Chrome/Edge (Windows):**
```
Registry Key: HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge
Value: AutoSelectCertificateForUrls
Type: REG_SZ
Data: {"pattern":"https://*.azurewebsites.us","filter":{"ISSUER":{"CN":"DOD ID CA-59"}}}
```

**Firefox (Windows):**
```
about:config
security.osclientcerts.autoload = true
security.enterprise_roots.enabled = true
```

### 5.3 Hardware Security Module (HSM) Requirements

**PIV-Compliant Cards:**
- CAC (Common Access Card) - FIPS 201-2 compliant
- PIV (Personal Identity Verification) - NIST SP 800-73-4
- Derived PIV (Mobile devices) - NIST SP 800-157

**Smart Card Readers:**
- **USB Readers:** SCR3310, Identiv uTrust, Gemalto IDBridge CT40
- **Built-in Readers:** Dell ControlVault, HP Integrated Smart Card Reader
- **Wireless Readers:** Not approved for SECRET systems

---

## 6. Testing and Validation

### 6.1 Certificate Authentication Test

**Test Procedure:**

**Step 1: Verify Certificate Installation**
```powershell
# List installed DOD certificates
Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object {$_.Issuer -like "*DoD*"}
```

**Step 2: Test Certificate Selection**
1. Open browser (Chrome/Edge)
2. Navigate to https://meetings.azurewebsites.us
3. Browser prompts for certificate selection
4. Select CAC Authentication certificate
5. Enter PIN
6. Verify Azure AD authentication success

**Step 3: Validate Token Claims**
```powershell
# Decode JWT token (PowerShell)
$token = "YOUR_JWT_TOKEN_HERE"
$payload = $token.Split('.')[1]
$decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload))
Write-Host $decoded

# Expected claims:
# - "amr": ["rsa", "mfa"]  # Certificate + PIN = MFA
# - "upn": "john.doe@dod.mil"
# - "unique_name": "john.doe@dod.mil"
```

### 6.2 Conditional Access Policy Validation

**Test Scenarios:**

**Scenario 1: Valid CAC/PIV Authentication**
- **Input:** User with valid CAC certificate on compliant device
- **Expected Result:** Authentication success, access granted

**Scenario 2: Missing CAC Certificate**
- **Input:** User attempts username/password login
- **Expected Result:** Authentication blocked, error message: "Certificate required"

**Scenario 3: Expired Certificate**
- **Input:** User with expired CAC certificate
- **Expected Result:** Authentication blocked, error message: "Certificate expired"

**Scenario 4: Non-Compliant Device**
- **Input:** User with valid CAC on non-compliant device (no BitLocker)
- **Expected Result:** Authentication blocked, error message: "Device non-compliant"

**Scenario 5: Geo-Location Block**
- **Input:** User attempts login from non-US IP address
- **Expected Result:** Authentication blocked, error message: "Access denied from this location"

### 6.3 Automated Testing Script

```powershell
# CAC/PIV Authentication Test Script
function Test-CACAuthentication {
    param (
        [string]$TestUserUPN,
        [string]$AppURL
    )
    
    Write-Host "Testing CAC authentication for $TestUserUPN..."
    
    # Test 1: Certificate availability
    $cert = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object {
        $_.Subject -like "*$TestUserUPN*" -and 
        $_.Issuer -like "*DOD*"
    }
    
    if ($null -eq $cert) {
        Write-Error "No DOD certificate found for $TestUserUPN"
        return $false
    }
    
    Write-Host "✓ Certificate found: $($cert.Subject)"
    
    # Test 2: Certificate validity
    if ($cert.NotAfter -lt (Get-Date)) {
        Write-Error "Certificate expired on $($cert.NotAfter)"
        return $false
    }
    
    Write-Host "✓ Certificate valid until $($cert.NotAfter)"
    
    # Test 3: Revocation check
    $chain = New-Object Security.Cryptography.X509Certificates.X509Chain
    $chain.ChainPolicy.RevocationMode = "Online"
    $chainValid = $chain.Build($cert)
    
    if (-not $chainValid) {
        Write-Error "Certificate revocation check failed"
        return $false
    }
    
    Write-Host "✓ Certificate not revoked"
    
    # Test 4: Conditional Access compliance
    $token = Get-MsalToken -ClientId "app-client-id" `
                           -TenantId "tenant-id" `
                           -Scope "https://graph.microsoft.com/.default" `
                           -ClientCertificate $cert
    
    if ($null -eq $token) {
        Write-Error "Failed to acquire token"
        return $false
    }
    
    Write-Host "✓ Token acquired successfully"
    
    Write-Host "`nAll CAC authentication tests passed!"
    return $true
}

# Run test
Test-CACAuthentication -TestUserUPN "john.doe@dod.mil" -AppURL "https://meetings.azurewebsites.us"
```

---

## 7. Troubleshooting

### 7.1 Common Issues

**Issue 1: "No certificate found" Error**

**Symptoms:** User receives "No valid certificate found" during authentication

**Causes:**
- CAC not inserted in reader
- Smart card middleware not installed
- Certificate expired or revoked
- Browser not configured for certificate selection

**Resolution:**
1. Verify CAC inserted and reader functional (`certutil -scinfo`)
2. Install ActivClient 7.x or CACKey
3. Verify certificate validity (`certutil -verify -urlfetch cert.cer`)
4. Configure browser for automatic certificate selection

**Issue 2: "Certificate not trusted" Error**

**Symptoms:** "This site's security certificate is not trusted"

**Causes:**
- DOD Root CA not installed in Azure AD
- CRL/OCSP validation failure
- Certificate chain incomplete

**Resolution:**
1. Upload DOD Root CA 3 to Azure AD trust store
2. Verify CRL accessible (`certutil -URL http://crl.disa.mil/crl/DODROOTCA3.crl`)
3. Install intermediate certificates

**Issue 3: "Access denied" after successful authentication**

**Symptoms:** User authenticates with CAC but receives 403 Forbidden

**Causes:**
- User not member of required Azure AD groups
- Conditional Access policy blocking access
- Device not compliant

**Resolution:**
1. Verify Azure AD group membership (`Get-AzureADUserMembership`)
2. Check Conditional Access sign-in logs for failure reason
3. Enroll device in Intune and ensure compliance

### 7.2 Diagnostic Commands

**Verify Certificate Installation:**
```powershell
# Windows
certutil -store -user My

# macOS
security find-certificate -a -p /Library/Keychains/System.keychain | openssl x509 -text

# Linux
pkcs15-tool --list-certificates
```

**Test Smart Card Reader:**
```powershell
# Windows
certutil -scinfo

# Expected output:
# Reader: ActivIdentity USB Reader V3 0
# Card: PIV-II (CAC)
# Container: 00
# Certificate: <certificate details>
```

**Verify Network Connectivity to OCSP/CRL:**
```powershell
# Test OCSP responder
Invoke-WebRequest -Uri "http://ocsp.disa.mil" -Method GET

# Test CRL download
Invoke-WebRequest -Uri "http://crl.disa.mil/crl/DODROOTCA3.crl" -OutFile "test.crl"
certutil -dump test.crl
```

**Check Conditional Access Policy Evaluation:**
```powershell
# View sign-in logs
Get-AzureADAuditSignInLogs -Filter "userPrincipalName eq 'john.doe@dod.mil'" | 
  Select-Object createdDateTime, status, conditionalAccessStatus, deviceDetail
```

---

## Appendix A: Certificate Enrollment Procedure

**For New Users:**

**Step 1: RAPIDS Appointment**
1. Schedule appointment at nearest RAPIDS site (https://rapids-appointments.dmdc.osd.mil/)
2. Bring two forms of ID (one photo ID)
3. Complete DD Form 1172-2 (Application for ID Card)

**Step 2: CAC Issuance**
1. RAPIDS operator verifies identity in DEERS
2. Biometric data collected (fingerprints, photo)
3. CAC printed and certificates issued
4. PIN set (6-8 digits)

**Step 3: Certificate Activation**
1. Insert CAC in smart card reader
2. Navigate to https://www.dmdc.osd.mil/self_service
3. Follow prompts to activate certificates
4. Test authentication at https://myaccess.dmdc.osd.mil

---

## Appendix B: Azure AD Certificate Mapping Examples

**Example 1: Standard CAC User**
```
Certificate Subject DN:
  CN=DOE.JOHN.1234567890, OU=USAF, OU=PKI, OU=DoD, O=U.S. Government, C=US

Certificate SAN:
  Principal Name: john.doe@us.af.mil

Azure AD Mapping:
  UserPrincipalName: john.doe@us.af.mil
  Mail: john.doe@us.af.mil
```

**Example 2: Contractor with Sponsored CAC**
```
Certificate Subject DN:
  CN=SMITH.JANE.CONTRACTOR.9876543210, OU=CONTRACTOR, OU=PKI, OU=DoD, O=U.S. Government, C=US

Certificate SAN:
  Principal Name: jane.smith.ctr@dod.mil

Azure AD Mapping:
  UserPrincipalName: jane.smith.ctr@dod.mil
  Mail: jane.smith.ctr@company.com
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-14 | Security Architect | Initial CAC/PIV configuration baseline |

**Classification:** UNCLASSIFIED  
**Distribution:** ISSO, System Administrators, Help Desk  
**Review Cycle:** Annual (or after PKI infrastructure changes)  
**Next Review:** 2026-11-14
