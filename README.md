# Teams Meeting Minutes - AI-Powered Demo Pilots

Two separate 20-user demonstration pilots for automated Microsoft Teams meeting minutes.

---

## Demo Pilots

### 1. Commercial Enterprise Demo
**Location:** `commercial_demo/`  
**Target:** Commercial enterprises evaluating AI meeting automation  
**Participants:** 20 commercial users  
**Duration:** 4-6 weeks  

**[View Commercial Demo Documentation →](commercial_demo/README.md)**

---

### 2. NAVY ERP Demo
**Location:** `navy_demo/`  
**Target:** NAVY ERP team members  
**Participants:** 20 NAVY ERP personnel  
**Duration:** 4-6 weeks  
**Tenant:** ABC123987.onmicrosoft.com  

**[View NAVY ERP Demo Documentation →](navy_demo/README.md)**

---

## What Both Demos Do

**Automatic Teams Meeting Capture:**
- Detects when Teams meeting ends
- Captures recording and transcript via Microsoft Graph API
- Processes in 2-3 minutes

**AI-Powered Minutes Generation:**
- Azure OpenAI (GPT-4o) generates structured minutes
- Extracts attendees, decisions, action items
- Requires minimal editing (<10 min)

**Approval & Distribution:**
- Review and approve workflow
- Email minutes to attendees (DOCX/PDF)
- Archive to SharePoint automatically

**Action Item Tracking:**
- Dashboard shows all action items
- Assignment and due date tracking
- Status updates and notifications

---

## Demo Scope (Both Pilots)

### ✅ Included
- 20 user accounts
- Azure Commercial environment (East US)
- Teams integration
- Azure OpenAI processing
- SharePoint archival
- Training and support

### ❌ NOT Included
- Production deployment
- Enterprise-wide rollout
- Security certifications (SOC 2 / ATO)
- Multi-region deployment
- Custom integrations
- Production system integration

---

## Quick Start

### For Commercial Demo
```bash
cd commercial_demo
# See README.md for setup instructions
```

### For NAVY ERP Demo
```bash
cd navy_demo
# See README.md for setup instructions
```

### Deploy Infrastructure
```bash
# Run deployment script
./deploy-azure-v2.sh

# Follow prompts for:
# - Tenant domain
# - Region (default: eastus)
# - Environment (demo)
# - Admin email
```

---

## Success Metrics (Both Demos)

**Technical:**
- 100% meeting capture rate
- AI accuracy 80%+
- Processing time <5 min
- 99%+ uptime

**User Experience:**
- 8/10 user satisfaction
- 80%+ adoption
- <10 min editing time

**Business Value:**
- 30+ min saved per meeting
- Clear ROI demonstrated
- Positive stakeholder feedback

---

## Architecture

**Frontend:** React + TypeScript, Shadcn UI, Tailwind CSS  
**Backend:** Node.js + Express, PostgreSQL, Drizzle ORM  
**AI:** Azure OpenAI (GPT-4o, Whisper)  
**Cloud:** Azure Commercial (East US)  
**Integration:** Microsoft Graph API, SharePoint  

---

## Documentation

- **Commercial Demo:** `commercial_demo/README.md`
- **NAVY ERP Demo:** `navy_demo/README.md`
- **System Architecture:** `replit.md`
- **Azure Deployment:** `azure-infrastructure/README.md`

---

## Support

**Commercial Demo:** Contact pilot coordinator  
**NAVY ERP Demo:** Weekly check-ins Tuesday 2PM ET

---

**Both pilots are time-boxed proof-of-concepts. Production deployment requires separate planning and authorization.**
