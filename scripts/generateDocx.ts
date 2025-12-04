import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

async function generateArchitectureDocx() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Teams Meeting Minutes AI",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: "Architecture Documentation",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Version: ", bold: true }),
            new TextRun("1.0"),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Date: ", bold: true }),
            new TextRun("December 2024"),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Classification: ", bold: true }),
            new TextRun("Unclassified"),
          ],
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "1. Executive Summary",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: "The Teams Meeting Minutes AI system is an enterprise-grade Microsoft Teams application that automates the capture, generation, review, and distribution of meeting minutes. Built for Azure Commercial Cloud deployment, the system integrates deeply with Microsoft 365 services to provide a seamless experience within the Teams platform.",
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Key Capabilities",
          heading: HeadingLevel.HEADING_2,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Capability", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Description", style: "Strong" })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Automatic Meeting Detection")] }),
                new TableCell({ children: [new Paragraph("Real-time detection of meeting completion via Microsoft Graph webhooks")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("AI-Powered Minutes Generation")] }),
                new TableCell({ children: [new Paragraph("GPT-4o powered analysis of meeting transcripts")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Configurable Approval Workflow")] }),
                new TableCell({ children: [new Paragraph("Multi-level review and approval before distribution")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Document Export")] }),
                new TableCell({ children: [new Paragraph("Professional DOCX and PDF document generation")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Automated Distribution")] }),
                new TableCell({ children: [new Paragraph("Email delivery to attendees upon approval")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("SharePoint Archival")] }),
                new TableCell({ children: [new Paragraph("Automatic upload to designated SharePoint document library")] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "2. Technology Stack",
          heading: HeadingLevel.HEADING_1,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Layer", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Technology", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Purpose", style: "Strong" })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Frontend")] }),
                new TableCell({ children: [new Paragraph("React 18 + TypeScript")] }),
                new TableCell({ children: [new Paragraph("Single Page Application")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("UI Framework")] }),
                new TableCell({ children: [new Paragraph("Fluent UI React")] }),
                new TableCell({ children: [new Paragraph("Native Teams look and feel")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Backend")] }),
                new TableCell({ children: [new Paragraph("Node.js + Express")] }),
                new TableCell({ children: [new Paragraph("RESTful API server")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Database")] }),
                new TableCell({ children: [new Paragraph("PostgreSQL (Azure)")] }),
                new TableCell({ children: [new Paragraph("Relational data persistence")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("AI")] }),
                new TableCell({ children: [new Paragraph("Azure OpenAI (GPT-4o)")] }),
                new TableCell({ children: [new Paragraph("Minutes generation")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Authentication")] }),
                new TableCell({ children: [new Paragraph("Microsoft Entra ID + MSAL")] }),
                new TableCell({ children: [new Paragraph("Enterprise SSO")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Hosting")] }),
                new TableCell({ children: [new Paragraph("Azure Container Apps")] }),
                new TableCell({ children: [new Paragraph("Serverless containers")] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "3. Azure Services Required",
          heading: HeadingLevel.HEADING_1,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Service", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "SKU/Tier", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Purpose", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Est. Monthly Cost", style: "Strong" })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Azure Container Apps")] }),
                new TableCell({ children: [new Paragraph("Consumption")] }),
                new TableCell({ children: [new Paragraph("Application hosting")] }),
                new TableCell({ children: [new Paragraph("$0.000012/vCPU-sec")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Azure Database for PostgreSQL")] }),
                new TableCell({ children: [new Paragraph("Flexible Server (Burstable B1ms)")] }),
                new TableCell({ children: [new Paragraph("Data persistence")] }),
                new TableCell({ children: [new Paragraph("~$15-30")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Azure OpenAI Service")] }),
                new TableCell({ children: [new Paragraph("Standard S0")] }),
                new TableCell({ children: [new Paragraph("GPT-4o for AI processing")] }),
                new TableCell({ children: [new Paragraph("Pay-per-token")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Microsoft Entra ID")] }),
                new TableCell({ children: [new Paragraph("Standard (with M365)")] }),
                new TableCell({ children: [new Paragraph("Authentication")] }),
                new TableCell({ children: [new Paragraph("Included")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Azure Container Registry")] }),
                new TableCell({ children: [new Paragraph("Basic")] }),
                new TableCell({ children: [new Paragraph("Docker image storage")] }),
                new TableCell({ children: [new Paragraph("~$5")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Application Insights")] }),
                new TableCell({ children: [new Paragraph("Basic")] }),
                new TableCell({ children: [new Paragraph("Monitoring and logging")] }),
                new TableCell({ children: [new Paragraph("~$2.30/GB")] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "4. Azure OpenAI Token Consumption Estimate",
          heading: HeadingLevel.HEADING_1,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Meeting Type", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Avg Transcript Words", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Input Tokens", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Output Tokens", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Est. Cost", style: "Strong" })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Short (30 min)")] }),
                new TableCell({ children: [new Paragraph("3,000")] }),
                new TableCell({ children: [new Paragraph("~4,000")] }),
                new TableCell({ children: [new Paragraph("~1,500")] }),
                new TableCell({ children: [new Paragraph("~$0.07")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Medium (1 hour)")] }),
                new TableCell({ children: [new Paragraph("7,000")] }),
                new TableCell({ children: [new Paragraph("~9,000")] }),
                new TableCell({ children: [new Paragraph("~2,000")] }),
                new TableCell({ children: [new Paragraph("~$0.14")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Long (2 hours)")] }),
                new TableCell({ children: [new Paragraph("15,000")] }),
                new TableCell({ children: [new Paragraph("~20,000")] }),
                new TableCell({ children: [new Paragraph("~3,000")] }),
                new TableCell({ children: [new Paragraph("~$0.29")] }),
              ],
            }),
          ],
        }),
        new Paragraph({
          text: "Based on GPT-4o pricing: $5/1M input tokens, $15/1M output tokens",
          italics: true,
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "5. Workload Sizing Recommendations",
          heading: HeadingLevel.HEADING_1,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Organization Size", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Daily Meetings", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Container Apps Config", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "PostgreSQL Tier", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Est. Monthly", style: "Strong" })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Small (< 100 users)")] }),
                new TableCell({ children: [new Paragraph("5-20")] }),
                new TableCell({ children: [new Paragraph("0.5 vCPU, 1 Gi, 1-2 replicas")] }),
                new TableCell({ children: [new Paragraph("Burstable B1ms")] }),
                new TableCell({ children: [new Paragraph("~$50-80")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Medium (100-500 users)")] }),
                new TableCell({ children: [new Paragraph("20-100")] }),
                new TableCell({ children: [new Paragraph("1 vCPU, 2 Gi, 2-5 replicas")] }),
                new TableCell({ children: [new Paragraph("Burstable B2s")] }),
                new TableCell({ children: [new Paragraph("~$120-200")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Large (500+ users)")] }),
                new TableCell({ children: [new Paragraph("100+")] }),
                new TableCell({ children: [new Paragraph("2 vCPU, 4 Gi, 5-10 replicas")] }),
                new TableCell({ children: [new Paragraph("General Purpose D2s")] }),
                new TableCell({ children: [new Paragraph("~$300-500")] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Scaling Considerations:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "• Container Apps auto-scales based on HTTP request concurrency (threshold: 100 concurrent)" }),
        new Paragraph({ text: "• Background job worker uses lease-based locking (only ONE active worker per deployment)" }),
        new Paragraph({ text: "• PostgreSQL connection pooling recommended for > 100 concurrent users" }),
        new Paragraph({ text: "• Graph API rate limits: 10,000 requests per 10 minutes per tenant" }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "6. Important: Approval Workflow Note",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: "The system implements an explicit approval workflow where:",
        }),
        new Paragraph({ text: "1. AI generates minutes automatically after meeting ends" }),
        new Paragraph({ text: "2. Minutes remain in \"Pending Review\" status until approver action" }),
        new Paragraph({ text: "3. Email distribution only occurs after explicit user approval (not automatic)", bold: true }),
        new Paragraph({ text: "4. SharePoint archival occurs as part of the post-approval pipeline" }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "This design ensures human oversight of all AI-generated content before distribution.",
          italics: true,
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "7. Microsoft Graph Permissions Required",
          heading: HeadingLevel.HEADING_1,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Permission", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Type", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Purpose", style: "Strong" })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Calendars.Read")] }),
                new TableCell({ children: [new Paragraph("Delegated")] }),
                new TableCell({ children: [new Paragraph("Read user calendar events")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("User.Read")] }),
                new TableCell({ children: [new Paragraph("Delegated")] }),
                new TableCell({ children: [new Paragraph("Read user profile")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("GroupMember.Read.All")] }),
                new TableCell({ children: [new Paragraph("Delegated")] }),
                new TableCell({ children: [new Paragraph("Read user group membership")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("CallRecords.Read.All")] }),
                new TableCell({ children: [new Paragraph("Application")] }),
                new TableCell({ children: [new Paragraph("Receive call record webhooks")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("OnlineMeetings.Read")] }),
                new TableCell({ children: [new Paragraph("Delegated")] }),
                new TableCell({ children: [new Paragraph("Read online meeting details")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("OnlineMeetingTranscript.Read.All")] }),
                new TableCell({ children: [new Paragraph("Application")] }),
                new TableCell({ children: [new Paragraph("Access meeting transcripts")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Mail.Send")] }),
                new TableCell({ children: [new Paragraph("Delegated")] }),
                new TableCell({ children: [new Paragraph("Send distribution emails")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Sites.ReadWrite.All")] }),
                new TableCell({ children: [new Paragraph("Delegated")] }),
                new TableCell({ children: [new Paragraph("Upload to SharePoint")] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "8. Microsoft Entra ID App Registration",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: "Application Settings:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "• Application (client) ID: {generated-guid}" }),
        new Paragraph({ text: "• Supported account types: Accounts in any organizational directory (Multi-tenant)" }),
        new Paragraph({ text: "• Redirect URIs: https://{app-hostname}/auth/callback" }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Expose an API:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "• Application ID URI: api://{app-hostname}/{client-id}" }),
        new Paragraph({ text: "• Scopes: access_as_user (Admins and users)" }),
        new Paragraph({ text: "• Authorized client applications:" }),
        new Paragraph({ text: "  - 1fec8e78-bce4-4aaf-ab1b-5451cc387264 (Teams desktop/mobile)" }),
        new Paragraph({ text: "  - 5e3ce6c0-2b1f-4285-8d4b-75ee78787346 (Teams web)" }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "9. Security Architecture",
          heading: HeadingLevel.HEADING_1,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Control", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Implementation", style: "Strong" })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Transport Security")] }),
                new TableCell({ children: [new Paragraph("TLS 1.2+ required for all connections")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Token Validation")] }),
                new TableCell({ children: [new Paragraph("MSAL JWT validation with JWKS")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("OBO Token Exchange")] }),
                new TableCell({ children: [new Paragraph("Fail-closed design (returns null on error)")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Session Management")] }),
                new TableCell({ children: [new Paragraph("Encrypted sessions with configurable TTL")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Secret Storage")] }),
                new TableCell({ children: [new Paragraph("Environment variables or Azure Key Vault")] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "10. Deployment Topology",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({ text: "Production Infrastructure:", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "• Client → Azure Container Apps → Express.js → PostgreSQL" }),
        new Paragraph({ text: "• Container Apps connects to: Entra ID (auth), Microsoft Graph (data), Azure OpenAI (AI)" }),
        new Paragraph({ text: "• CI/CD: GitHub Actions → Azure Container Registry → Azure Container Apps" }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Prepared for Microsoft Azure cost estimation review",
          italics: true,
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(process.cwd(), 'docs', 'Teams_Meeting_Minutes_Architecture.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Architecture document saved to: ${outputPath}`);
  return outputPath;
}

async function generateDiagramsDocx() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "Teams Meeting Minutes AI",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: "Visio Diagram Guide",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: "Diagram specifications for Microsoft Visio conversion",
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Diagram 1: High-Level System Architecture",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Diagram Type: ", bold: true }),
            new TextRun("Network/Cloud Architecture"),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Visio Template: ", bold: true }),
            new TextRun("Azure Architecture (recommended)"),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Components to Place:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "TOP ROW (External/Microsoft 365):",
          heading: HeadingLevel.HEADING_3,
        }),
        new Paragraph({ text: "• Teams Client" }),
        new Paragraph({ text: "• Exchange Online" }),
        new Paragraph({ text: "• SharePoint" }),
        new Paragraph({ text: "• Calendar" }),
        new Paragraph({ text: "↓ Connect via Microsoft Graph API" }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "MIDDLE (Azure Container Apps):",
          heading: HeadingLevel.HEADING_3,
        }),
        new Paragraph({ text: "• React Frontend" }),
        new Paragraph({ text: "• Express API" }),
        new Paragraph({ text: "• Job Worker (lease-based)" }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "BOTTOM ROW (Azure Services):",
          heading: HeadingLevel.HEADING_3,
        }),
        new Paragraph({ text: "• PostgreSQL (Flexible Server)" }),
        new Paragraph({ text: "• Azure OpenAI (GPT-4o)" }),
        new Paragraph({ text: "• Entra ID (Authentication)" }),
        new Paragraph({ text: "• Key Vault (Optional)" }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Visio Shape Recommendations:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Component", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Visio Shape", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Color", style: "Strong" })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Teams Client")] }),
                new TableCell({ children: [new Paragraph("Microsoft Teams icon")] }),
                new TableCell({ children: [new Paragraph("Purple")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Exchange Online")] }),
                new TableCell({ children: [new Paragraph("Mail icon")] }),
                new TableCell({ children: [new Paragraph("Blue")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("SharePoint")] }),
                new TableCell({ children: [new Paragraph("SharePoint icon")] }),
                new TableCell({ children: [new Paragraph("Green")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Graph API")] }),
                new TableCell({ children: [new Paragraph("API gateway")] }),
                new TableCell({ children: [new Paragraph("Blue")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Container App")] }),
                new TableCell({ children: [new Paragraph("Container icon")] }),
                new TableCell({ children: [new Paragraph("Light blue")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("PostgreSQL")] }),
                new TableCell({ children: [new Paragraph("Database cylinder")] }),
                new TableCell({ children: [new Paragraph("Blue")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Azure OpenAI")] }),
                new TableCell({ children: [new Paragraph("Brain/AI icon")] }),
                new TableCell({ children: [new Paragraph("Purple")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Entra ID")] }),
                new TableCell({ children: [new Paragraph("Shield icon")] }),
                new TableCell({ children: [new Paragraph("Blue")] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Diagram 2: Meeting Lifecycle Flow",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Diagram Type: ", bold: true }),
            new TextRun("Flowchart/Process Flow"),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Visio Template: ", bold: true }),
            new TextRun("Basic Flowchart"),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Process Steps:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "1. User Schedules Teams Meeting" }),
        new Paragraph({ text: "2. Calendar Delta Sync Detects New Meeting (Microsoft Graph API)" }),
        new Paragraph({ text: "3. Meeting Occurs (Transcription Enabled)" }),
        new Paragraph({ text: "4. Meeting Ends - callRecords Webhook Fires (Graph Webhook)" }),
        new Paragraph({ text: "5. Enrichment Job Enqueued (Durable Queue)" }),
        new Paragraph({ text: "6. Fetch Transcript from Graph (Graph API)" }),
        new Paragraph({ text: "7. Processing Validation: Duration ≥ 2 min, Words ≥ 25, Transcript exists" }),
        new Paragraph({ text: "   → Decision: VALID? Yes → Continue, No → Skip with Audit Log" }),
        new Paragraph({ text: "8. AI Processing - Generate Minutes (Azure OpenAI GPT-4o)" }),
        new Paragraph({ text: "9. Pending Review - Approver Notified" }),
        new Paragraph({ text: "   → Decision: APPROVED? Yes → Continue, No → Return for Edit" }),
        new Paragraph({ text: "10. Generate DOCX and PDF" }),
        new Paragraph({ text: "11. Email to All Attendees (Exchange/Graph Mail)" }),
        new Paragraph({ text: "12. Upload to SharePoint (SharePoint API)" }),
        new Paragraph({ text: "13. END" }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Diagram 3: Authentication Flow",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Diagram Type: ", bold: true }),
            new TextRun("Sequence Diagram"),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Visio Template: ", bold: true }),
            new TextRun("UML Sequence"),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Actors & Lifelines:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "1. User (Actor)" }),
        new Paragraph({ text: "2. Teams Client (System)" }),
        new Paragraph({ text: "3. Backend API (System)" }),
        new Paragraph({ text: "4. Entra ID (External)" }),
        new Paragraph({ text: "5. Microsoft Graph (External)" }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Sequence Steps:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "1. User → Teams: Open App" }),
        new Paragraph({ text: "2. Teams → Backend: Get SSO Token" }),
        new Paragraph({ text: "3. Teams → Backend: API Call (Bearer Token)" }),
        new Paragraph({ text: "4. Backend → Entra ID: Validate JWT" }),
        new Paragraph({ text: "5. Backend → Entra ID: OBO Token Exchange" }),
        new Paragraph({ text: "6. Entra ID → Backend: Graph Token" }),
        new Paragraph({ text: "7. Backend → Graph API: Get /me/memberOf" }),
        new Paragraph({ text: "8. Graph API → Backend: User Groups" }),
        new Paragraph({ text: "9. Backend: Check Role & Clearance" }),
        new Paragraph({ text: "10. Backend → Teams: Response" }),
        new Paragraph({ text: "11. Teams → User: Display" }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Diagram 4: Background Job Processing",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Diagram Type: ", bold: true }),
            new TextRun("Component/Process Diagram"),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Visio Template: ", bold: true }),
            new TextRun("Software Architecture"),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Components:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "• Webhook Endpoint (receives Graph notifications)" }),
        new Paragraph({ text: "• Durable Job Queue (PostgreSQL Table)" }),
        new Paragraph({ text: "  - Jobs: pending, processing, completed, failed" }),
        new Paragraph({ text: "  - Features: Idempotency, Retry with exponential backoff, Dead letter queue, Crash recovery" }),
        new Paragraph({ text: "• Job Worker (Lease-Based)" }),
        new Paragraph({ text: "  - Worker Lease Table in PostgreSQL" }),
        new Paragraph({ text: "  - Only ONE worker active across all container instances" }),
        new Paragraph({ text: "  - Poll: Every 5 seconds, Lease: 15 seconds" }),
        new Paragraph({ text: "• External Services: Graph API, Azure OpenAI, SharePoint" }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Color Palette for Diagrams",
          heading: HeadingLevel.HEADING_1,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Component Type", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Hex Color", style: "Strong" })] }),
                new TableCell({ children: [new Paragraph({ text: "Usage", style: "Strong" })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Azure Services")] }),
                new TableCell({ children: [new Paragraph("#0078D4")] }),
                new TableCell({ children: [new Paragraph("Azure branding blue")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Microsoft 365")] }),
                new TableCell({ children: [new Paragraph("#106EBE")] }),
                new TableCell({ children: [new Paragraph("M365 branding")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Container/App")] }),
                new TableCell({ children: [new Paragraph("#68217A")] }),
                new TableCell({ children: [new Paragraph("Container apps purple")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Database")] }),
                new TableCell({ children: [new Paragraph("#004578")] }),
                new TableCell({ children: [new Paragraph("Data storage")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Success/Approved")] }),
                new TableCell({ children: [new Paragraph("#107C10")] }),
                new TableCell({ children: [new Paragraph("Green states")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Warning/Pending")] }),
                new TableCell({ children: [new Paragraph("#FFB900")] }),
                new TableCell({ children: [new Paragraph("Yellow/amber states")] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Error/Rejected")] }),
                new TableCell({ children: [new Paragraph("#D13438")] }),
                new TableCell({ children: [new Paragraph("Red states")] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Export Notes for Microsoft",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({ text: "When converting to Visio:" }),
        new Paragraph({ text: "1. Use Azure Architecture stencil for accurate icons" }),
        new Paragraph({ text: "2. Maintain consistent spacing (32px grid recommended)" }),
        new Paragraph({ text: "3. Use official Microsoft color palette" }),
        new Paragraph({ text: "4. Add legend for custom symbols" }),
        new Paragraph({ text: "5. Export as .vsdx (Visio 2013+) and .pdf for review" }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
          text: "Prepared for Microsoft Azure cost estimation review",
          italics: true,
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(process.cwd(), 'docs', 'Teams_Meeting_Minutes_Diagrams.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Diagrams document saved to: ${outputPath}`);
  return outputPath;
}

async function main() {
  console.log("Generating Word documents...\n");
  
  const archPath = await generateArchitectureDocx();
  const diagPath = await generateDiagramsDocx();
  
  console.log("\n✓ Documents generated successfully!");
  console.log(`\nDownload from:`);
  console.log(`  1. ${archPath}`);
  console.log(`  2. ${diagPath}`);
}

main().catch(console.error);
