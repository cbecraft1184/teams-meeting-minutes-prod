# DOD Teams Meeting Minutes - Technology Stack

## Complete Manifest of Tools and Programming Languages

---

## Core Programming Languages

| Language | Version | Usage |
|----------|---------|-------|
| **TypeScript** | 5.x | Primary language for frontend and backend |
| **JavaScript** | ES2022+ | Runtime execution (Node.js) |
| **SQL** | PostgreSQL 15.x | Database queries and schema |
| **Bash/Shell** | - | Deployment scripts and automation |
| **PowerShell** | 7.x | Microsoft Graph API administration |

---

## Frontend Stack

### Framework & Runtime
- **React** 18.x - UI component framework
- **TypeScript** 5.x - Type-safe JavaScript
- **Vite** 5.x - Build tool and dev server

### Routing
- **Wouter** 3.x - Lightweight React router

### State Management
- **TanStack Query** (React Query) v5 - Server state management
  - Data fetching
  - Caching
  - Synchronization
  - Optimistic updates

### UI Component Libraries
- **Shadcn UI** - Customizable component system
- **Radix UI** - Unstyled, accessible component primitives:
  - Accordion, Alert Dialog, Avatar
  - Checkbox, Dialog, Dropdown Menu
  - Label, Popover, Radio Group
  - Scroll Area, Select, Separator
  - Slider, Switch, Tabs
  - Toast, Tooltip, Toggle

### Styling
- **Tailwind CSS** 3.x - Utility-first CSS framework
- **PostCSS** - CSS processing
- **Autoprefixer** - Browser compatibility
- **tailwindcss-animate** - Animation utilities
- **class-variance-authority** - Component variants
- **tailwind-merge** - Tailwind class merging
- **clsx** - Conditional class names

### Icons
- **Lucide React** - Icon library
- **React Icons** - Additional icons (company logos)

### Form Management
- **React Hook Form** 7.x - Form state management
- **Zod** 3.x - Schema validation
- **@hookform/resolvers** - Zod integration

### Date Handling
- **date-fns** 2.x - Date utility functions
- **react-day-picker** - Date picker component

### UI Utilities
- **Framer Motion** - Animations
- **Embla Carousel** - Carousel component
- **Recharts** - Charts and data visualization
- **React Resizable Panels** - Resizable layouts
- **cmdk** - Command menu
- **Vaul** - Drawer component
- **input-otp** - OTP input

---

## Backend Stack

### Runtime & Framework
- **Node.js** 20.x - JavaScript runtime
- **Express** 4.x - Web application framework
- **TypeScript** 5.x - Type-safe development
- **tsx** - TypeScript execution

### Database
- **PostgreSQL** 15.x - Primary database
- **Drizzle ORM** 0.x - TypeScript ORM
  - Type-safe queries
  - Schema management
  - Migrations
- **@neondatabase/serverless** - PostgreSQL driver
- **drizzle-kit** - Schema management tools
- **drizzle-zod** - Zod schema generation

### Authentication & Authorization
- **Passport** 0.7.x - Authentication middleware
- **passport-local** - Local strategy (dev)
- **express-session** 1.x - Session management
- **connect-pg-simple** - PostgreSQL session store
- **memorystore** - Memory session store (dev)

### Microsoft Integration
- **@microsoft/microsoft-graph-client** - Microsoft Graph API client
  - Teams meeting access
  - User management
  - Email distribution
  - Calendar integration
  - SharePoint access

### AI Integration
- **OpenAI SDK** 4.x - Azure OpenAI integration
  - GPT-4 for transcript processing
  - Meeting summarization
  - Action item extraction

### Document Generation
- **docx** 8.x - DOCX document generation
- **pdf-lib** 1.x - PDF document generation
- **archiver** 7.x - ZIP file creation

### Validation & Parsing
- **Zod** 3.x - Runtime type validation
- **zod-validation-error** - Error formatting

### Utilities
- **p-limit** - Concurrency control
- **p-retry** - Retry logic for API calls
- **ws** - WebSocket support

---

## Development Tools

### Build Tools
- **Vite** 5.x - Frontend bundler
- **esbuild** - Fast JavaScript bundler
- **@vitejs/plugin-react** - React plugin for Vite
- **@tailwindcss/vite** - Tailwind CSS plugin

### Replit-Specific Plugins
- **@replit/vite-plugin-cartographer** - Development tools
- **@replit/vite-plugin-dev-banner** - Development banner
- **@replit/vite-plugin-runtime-error-modal** - Error overlay

### Type Checking
- **TypeScript** 5.x - Static type checking
- **@types/node** - Node.js type definitions
- **@types/express** - Express type definitions
- **@types/react** - React type definitions
- **@types/react-dom** - React DOM type definitions
- **@types/passport** - Passport type definitions
- **@types/express-session** - Session type definitions
- **@types/archiver** - Archiver type definitions
- **@types/ws** - WebSocket type definitions

### Package Management
- **npm** 10.x - Package manager
- **package.json** - Dependency management

### Version Control
- **Git** - Source control

---

## Cloud & Infrastructure (AWS Deployment)

### AWS Services
- **Amazon ECS Fargate** - Container orchestration (serverless)
- **AWS Elastic Beanstalk** - Alternative PaaS deployment
- **Amazon RDS** - PostgreSQL database hosting
- **AWS Secrets Manager** - Credential management
- **Application Load Balancer** - HTTPS traffic distribution
- **Amazon CloudWatch** - Logging and monitoring
- **AWS Certificate Manager** - SSL/TLS certificates
- **Amazon ECR** - Docker image registry
- **Amazon S3** - Static asset storage (optional)
- **AWS IAM** - Identity and access management

### AWS SDK
- **@aws-sdk/client-secrets-manager** - Secrets retrieval

### Containerization
- **Docker** - Container packaging
- **Docker Compose** - Multi-container orchestration (local dev)

### Deployment Tools
- **AWS CLI** - Command-line deployment
- **EB CLI** - Elastic Beanstalk CLI

---

## Microsoft Azure Services

### Azure AD (Entra ID)
- **Azure Active Directory** - Identity provider
  - SSO authentication
  - JWT token validation
  - User provisioning
  - API permissions management

### Azure OpenAI Service
- **Azure OpenAI** (Gov Cloud capable) - AI processing
  - GPT-4 deployment
  - Transcript analysis
  - Meeting summarization
  - Gov Cloud compliance

### SharePoint
- **SharePoint Online** - Document archival
  - DOD-compliant storage
  - Classification-based folders
  - Metadata management
  - Permission-based access

### Microsoft Graph API
- **Graph API v1.0** - Microsoft 365 integration
  - Teams meeting events
  - User information
  - Email sending
  - Calendar access
  - File operations

---

## Microsoft Teams

### Teams Platform
- **Microsoft Teams** - Host application
- **Teams JavaScript SDK** - Teams integration
- **Teams App Manifest** v1.16 - App configuration
- **Teams Admin Center** - App management

### Teams Components
- **Static Tabs** - App display
- **SSO (Single Sign-On)** - Authentication
- **Graph API Webhooks** - Event notifications

---

## Testing & Quality Assurance

### Testing Frameworks (Ready to Integrate)
- **Playwright** - End-to-end testing (via Replit run_test tool)
- **Jest** (optional) - Unit testing
- **React Testing Library** (optional) - Component testing

### Code Quality
- **TypeScript Compiler** - Type checking
- **ESLint** (configurable) - Linting
- **Prettier** (configurable) - Code formatting

---

## Security & Compliance

### Authentication
- **Azure AD JWT tokens** - Token-based authentication
- **Passport.js** - Authentication middleware
- **bcrypt** (for local dev) - Password hashing

### Authorization
- **Role-Based Access Control (RBAC)** - Custom implementation
  - Viewer, Approver, Auditor, Admin roles
- **Clearance-Based Filtering** - Custom implementation
  - UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP_SECRET levels
- **Attendee-Based Filtering** - Custom implementation

### Data Protection
- **HTTPS/TLS** - Transport encryption
- **PostgreSQL Encryption** - Database encryption at rest
- **AWS Secrets Manager** - Credential encryption
- **Session Secrets** - Session security

### Compliance
- **FedRAMP** - Via AWS Gov Cloud
- **FISMA** - Via AWS Gov Cloud
- **DOD Standards** - Classification markings
- **Audit Logging** - Access control logs

---

## Development Environment

### Platform Options
1. **Replit** (Development/Testing)
   - Built-in PostgreSQL
   - Automatic HTTPS
   - Secrets management
   - One-click deployment
   - Auto-scaling

2. **AWS** (Production)
   - Gov Cloud support
   - Enterprise-grade infrastructure
   - Full control and customization

### Local Development
- **Node.js** 20.x runtime
- **npm** package manager
- **Git** version control
- **VS Code** or any IDE

---

## Architecture Patterns & Methodologies

### Design Patterns
- **RESTful API** - Backend API design
- **Single Page Application (SPA)** - Frontend architecture
- **Server-Side Rendering** (SSR ready) - Via Vite
- **Optimistic Updates** - UI responsiveness
- **Component-Based Architecture** - React components
- **Service Layer Pattern** - Backend services
- **Repository Pattern** - Data access (via storage interface)

### Architectural Principles
- **Separation of Concerns** - Frontend/Backend split
- **Type Safety** - TypeScript throughout
- **Dependency Injection** - Loose coupling
- **Interface Segregation** - Storage interfaces
- **DRY (Don't Repeat Yourself)** - Code reusability

---

## Data Formats & Protocols

### Web Standards
- **HTTP/HTTPS** - Communication protocol
- **WebSocket** (ws) - Real-time updates
- **REST** - API architecture
- **JSON** - Data interchange format
- **JWT** - Authentication tokens
- **OAuth 2.0** - Authorization protocol

### Document Formats
- **DOCX** (Office Open XML) - Word documents
- **PDF** - Portable Document Format
- **ZIP** - Archive format
- **PNG** - Image format (icons)
- **JSON** - Configuration files

### Database
- **SQL** - Query language
- **PostgreSQL Wire Protocol** - Database communication

---

## Third-Party Services Integration

### Microsoft Services
- ✅ Microsoft Graph API
- ✅ Azure AD (Entra ID)
- ✅ Azure OpenAI Service
- ✅ SharePoint Online
- ✅ Microsoft Teams
- ✅ Exchange Online (email)

### Cloud Services
- ✅ AWS (multiple services)
- ✅ Azure (multiple services)

---

## Configuration & Environment

### Environment Variables
- `NODE_ENV` - Environment mode
- `DATABASE_URL` - PostgreSQL connection
- `MICROSOFT_TENANT_ID` - Azure AD tenant
- `MICROSOFT_CLIENT_ID` - Azure AD app ID
- `MICROSOFT_CLIENT_SECRET` - Azure AD secret
- `AZURE_OPENAI_ENDPOINT` - OpenAI endpoint
- `AZURE_OPENAI_API_KEY` - OpenAI key
- `AZURE_OPENAI_DEPLOYMENT` - Model deployment
- `SHAREPOINT_SITE_URL` - SharePoint site
- `SHAREPOINT_LIBRARY` - Document library
- `SESSION_SECRET` - Session encryption
- `AWS_REGION` - AWS region (for Gov Cloud)

### Configuration Files
- `package.json` - NPM dependencies
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `drizzle.config.ts` - Drizzle ORM configuration
- `postcss.config.js` - PostCSS configuration
- `.env` - Environment variables (local)
- `manifest.json` - Teams app manifest
- `Dockerfile` - Container configuration (AWS)
- `task-definition.json` - ECS task definition (AWS)

---

## Package Dependencies Summary

### Total NPM Packages: ~75+

**Production Dependencies**: ~50
- React ecosystem: 10+
- UI components: 20+
- Backend: 15+
- Microsoft integration: 5+
- Utilities: 10+

**Development Dependencies**: ~25
- TypeScript types: 10+
- Build tools: 10+
- Development plugins: 5+

### Package Manager
- **npm** with `package-lock.json` for dependency locking

---

## Documentation & Guides Created

### Deployment Guides
1. **AWS_DEPLOYMENT_GUIDE.md** - Complete AWS deployment instructions
2. **IMPLEMENTATION_GUIDE.md** - Replit deployment instructions
3. **TEAMS_APP_DEPLOYMENT.md** - Teams app installation guide

### Technical Documentation
4. **replit.md** - Project overview and architecture
5. **TECHNOLOGY_STACK.md** (this file) - Complete technology manifest

---

## Development Workflow

### Version Control
- **Git** - Source control
- Automatic commits via Replit
- Manual commits for AWS deployment

### Deployment Pipeline
1. **Development** - Replit environment
2. **Testing** - Replit or local
3. **Staging** - AWS (optional)
4. **Production** - AWS Gov Cloud

### Continuous Integration (Ready to Add)
- GitHub Actions (optional)
- AWS CodePipeline (optional)
- Automated testing (optional)

---

## Performance & Optimization

### Frontend Optimization
- **Code Splitting** - Vite automatic splitting
- **Lazy Loading** - React lazy components
- **Tree Shaking** - Unused code elimination
- **Asset Optimization** - Image compression
- **CSS Purging** - Tailwind CSS purge

### Backend Optimization
- **Database Indexing** - PostgreSQL indexes
- **Query Optimization** - Drizzle ORM
- **Connection Pooling** - PostgreSQL pools
- **Caching** - React Query caching
- **Compression** - gzip/brotli (via ALB)

### Scalability
- **Horizontal Scaling** - ECS auto-scaling
- **Database Scaling** - RDS read replicas
- **Load Balancing** - Application Load Balancer
- **Session Storage** - PostgreSQL-backed sessions

---

## Monitoring & Observability

### Logging
- **Console Logging** - Development
- **CloudWatch Logs** - Production (AWS)
- **Structured Logging** - JSON format

### Metrics
- **Application Metrics** - Custom logging
- **CloudWatch Metrics** - AWS services
- **RDS Metrics** - Database performance

### Alerting (Production)
- **CloudWatch Alarms** - Automated alerts
- **SNS Notifications** - Alert delivery

---

## Compliance & Standards

### Web Standards
- **W3C HTML5** - Markup
- **CSS3** - Styling
- **ES2022+** - JavaScript features
- **WCAG 2.1** - Accessibility (ready)

### API Standards
- **OpenAPI/Swagger** - API documentation (ready to add)
- **REST** - API design
- **JSON Schema** - Data validation

### Security Standards
- **OWASP** - Security best practices
- **NIST** - DOD compliance
- **FedRAMP** - Federal cloud security

---

## License & Legal

### Open Source Licenses
- **MIT License** - Most dependencies
- **Apache 2.0** - Some dependencies
- **BSD** - Some dependencies

*Note: Verify all licenses for DOD compliance*

---

## System Requirements

### Development
- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **PostgreSQL** 15.x or higher
- **4GB RAM** minimum
- **Modern browser** (Chrome, Edge, Firefox)

### Production (AWS)
- **ECS Task**: 1-2 vCPU, 2-4 GB RAM per task
- **RDS**: db.t3.medium or higher
- **ALB**: Standard configuration
- **Network**: VPC with public/private subnets

---

## Future Technology Considerations

### Potential Additions
- **Redis** - Advanced caching
- **Elasticsearch** - Advanced search
- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization
- **Sentry** - Error tracking
- **DataDog** - APM monitoring

### Alternative Stacks (Not Used)
- ~~Next.js~~ (using Vite + Wouter)
- ~~MongoDB~~ (using PostgreSQL)
- ~~REST frameworks~~ (using Express)
- ~~GraphQL~~ (using REST)

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Programming Languages** | 5 (TS, JS, SQL, Bash, PowerShell) |
| **NPM Packages** | 75+ |
| **AWS Services** | 10+ |
| **Azure Services** | 5+ |
| **Microsoft APIs** | 1 (Graph API) |
| **UI Components** | 30+ (Shadcn + custom) |
| **Backend Services** | 6 (custom service classes) |
| **Database Tables** | 6 (meetings, minutes, actions, templates, users, access_logs) |
| **API Endpoints** | 20+ REST endpoints |
| **Pages** | 4 (Dashboard, Meetings, Search, Settings) |

---

## Key Technology Decisions

### Why TypeScript?
- Type safety for large codebase
- Better IDE support
- Fewer runtime errors
- Self-documenting code

### Why React?
- Component reusability
- Large ecosystem
- Microsoft Teams compatibility
- Strong typing with TypeScript

### Why PostgreSQL?
- ACID compliance
- DOD-grade reliability
- Advanced features (JSONB, arrays)
- AWS RDS support

### Why Vite?
- Fast development server
- Excellent TypeScript support
- Modern build optimization
- Better than webpack for this use case

### Why Drizzle ORM?
- Type-safe queries
- No code generation
- Excellent TypeScript integration
- Lightweight and fast

### Why AWS?
- Gov Cloud availability
- DOD compliance (FedRAMP, FISMA)
- Enterprise-grade reliability
- Scalability for 300K+ users

---

**Last Updated**: October 31, 2025
**Version**: 1.0.0
**Maintained By**: DOD IT Department
