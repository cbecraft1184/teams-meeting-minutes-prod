# Scenario-Specific Documentation Templates
## FROM-SCRATCH REWRITE GUIDANCE

This document defines the strict narrative boundaries for DOD vs Commercial documentation packages to prevent cross-contamination.

---

## DOD Deployment Scenario Template

### Narrative Tone
- **Mission-focused**: Emphasize operational capability, security posture, compliance
- **Government language**: ATO process, FedRAMP High, data sovereignty, classification handling
- **No commercialization**: Zero market analysis, revenue models, competitive positioning, IBM branding

### Compliance Posture
- **Primary Framework**: FedRAMP High (NIST 800-53 controls)
- **Authorization**: ATO (Authority to Operate) process, 16-month timeline
- **Classification Support**: UNCLASSIFIED, CONFIDENTIAL, SECRET levels
- **Standards**: DoDI 5015.02 (records management), DoDM 5200.01 (classification marking)

### Infrastructure Details
- **Cloud Environment**: Azure Government (GCC High) ONLY
- **Regions**: USGov Virginia, USGov Arizona (government-only regions)
- **Authentication**: CAC/PIV card integration mandatory
- **Endpoints**: ALL .gov, .mil, or graph.microsoft.us domains

### Identity/Access
- **Primary Auth**: CAC/PIV smart cards
- **Secondary Auth**: Azure AD Government
- **Access Control**: Clearance-level groups (IL5 data segregation)

### Key Terminology
- ✅ USE: Mission capability, operational efficiency, data sovereignty, warfighter support, ATO timeline
- ❌ AVOID: Market opportunity, revenue potential, competitive advantage, commercialization, SaaS economics

### Executive Framing
- **Audience**: DOD Leadership, Government Program Managers
- **Decision Point**: Authorization to proceed with pilot and ATO process
- **Value Proposition**: Enhanced mission effectiveness, compliance support, reduced administrative burden

---

## Commercial Enterprise Scenario Template

### Narrative Tone
- **Market-focused**: Emphasize business value, ROI, competitive positioning
- **Enterprise language**: SaaS economics, multi-tenant architecture, SOC 2 compliance
- **No government references**: Zero FedRAMP, ATO, classification levels, CAC/PIV, Azure Government

### Compliance Posture
- **Primary Framework**: SOC 2 Type II
- **Secondary Standards**: ISO 27001, GDPR compliance
- **Data Handling**: Enterprise-grade encryption, role-based access control
- **NO classification**: Use service tiers (Standard/Enhanced/Premium) instead

### Infrastructure Details
- **Cloud Environment**: Azure Commercial (public cloud) ONLY
- **Regions**: East US, West US, West Europe, Southeast Asia (commercial regions)
- **Authentication**: Azure AD (commercial) with SAML/OAuth
- **Endpoints**: ALL .com domains (graph.microsoft.com, login.microsoftonline.com)

### Identity/Access
- **Primary Auth**: Azure AD (commercial) SSO
- **MFA**: Authenticator app, SMS, FIDO2 keys
- **Access Control**: Role-based access control (RBAC), not clearance-based

### Key Terminology
- ✅ USE: Market opportunity, revenue model, competitive landscape, enterprise customers, SaaS platform
- ❌ AVOID: FedRAMP, ATO, classification levels, CAC/PIV, Azure Government, .gov/.mil domains

### Executive Framing
- **Audience**: Enterprise executives, C-suite decision makers
- **Decision Point**: Investment approval for product development and market launch
- **Value Proposition**: First-mover advantage, market leadership, revenue opportunity

---

## Critical Contamination Patterns to Avoid

### Commercial Package MUST NOT Include
- ❌ Azure Government / GCC High / IL5
- ❌ USGov Virginia / USGov Arizona regions
- ❌ FedRAMP / ATO / NIST 800-53
- ❌ CAC/PIV authentication
- ❌ Classification levels (UNCLASSIFIED/CONFIDENTIAL/SECRET)
- ❌ .gov / .mil / .us domains
- ❌ DoDI / DoDM references
- ❌ Mission/warfighter language

### DOD Package MUST NOT Include
- ❌ IBM branding / commercial partnership language
- ❌ Market analysis / revenue models / competitive positioning
- ❌ SaaS economics / multi-tenant pricing
- ❌ Fortune 500 / enterprise market language
- ❌ First-mover advantage / commercialization strategy
- ❌ SOC 2 (use FedRAMP High instead)
- ❌ Commercial Azure regions (East US/West US - use USGov regions)
- ❌ .com endpoints for Microsoft services (use .us)

---

## Quality Gate Checklist

### Before Packaging - Automated Scan
Run contamination scan and ensure **ZERO hits**:

```bash
# Commercial package - should return 0
grep -ri "fedramp\|gcc high\|azure government\|cac/piv\|\.gov\|\.mil\|\.us\|unclass\|confidential\|secret\|virginia region\|arizona region" commercial_documentation/

# DOD package - should return 0  
grep -ri "ibm\|fortune 500\|market opportunity\|revenue model\|commercialization\|soc 2\|east us\|west us\|\.com endpoints" dod_documentation/
```

### Before Packaging - Manual Review
- [ ] Executive summaries read naturally for target audience
- [ ] All API/infrastructure references match scenario (endpoints, regions)
- [ ] Compliance frameworks are scenario-appropriate (FedRAMP vs SOC 2)
- [ ] Authentication methods match scenario (CAC/PIV vs Azure AD SSO)
- [ ] No cross-scenario file references in master indices
- [ ] Tone and language consistent throughout each package

---

## Rewrite Strategy

### For Each Document Family:
1. **DELETE existing contaminated content** - don't try to edit
2. **Start from blank document** with scenario template
3. **Write fresh narrative** using appropriate tone/terminology
4. **Peer review** against contamination checklist
5. **Automated scan** before moving to next document

### Priority Order (highest risk first):
1. Executive Summaries (Concise + Comprehensive)
2. Investment Snapshots
3. Deployment + Scalability Guides
4. SharePoint Integration Plans
5. Master Documentation Indices
