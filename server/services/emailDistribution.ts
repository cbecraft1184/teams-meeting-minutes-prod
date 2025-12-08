/**
 * Email Distribution Service for Meeting Minutes
 * 
 * In production (Azure Commercial/Government):
 * - Uses Microsoft Graph API to send emails through Outlook
 * - Requires Azure AD authentication and Graph API permissions
 * 
 * In development:
 * - Logs email to console (no actual sending)
 */

import type { MeetingWithMinutes } from "@shared/schema";
import { format } from "date-fns";
import { acquireTokenByClientCredentials } from "./microsoftIdentity";
import { getConfig } from "./configValidator";

interface EmailRecipient {
  email: string;
  name?: string;
}

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export class EmailDistributionService {
  private graphApiEndpoint = "https://graph.microsoft.com/v1.0";

  /**
   * Check if mock services are enabled
   */
  private get useMockServices(): boolean {
    const config = getConfig();
    return config.useMockServices;
  }

  /**
   * Send meeting minutes to all attendees AND the organizer
   */
  async distributeMinutes(
    meeting: MeetingWithMinutes,
    attachments: EmailAttachment[]
  ): Promise<void> {
    if (!meeting.minutes) {
      throw new Error("Meeting has no minutes to distribute");
    }

    // Start with attendees
    const recipientEmails = new Set<string>(meeting.attendees);
    
    // Always include the organizer so they receive a copy
    if (meeting.organizerEmail) {
      recipientEmails.add(meeting.organizerEmail);
    }

    const recipients: EmailRecipient[] = Array.from(recipientEmails).map(email => ({
      email,
      name: email.split("@")[0].replace(".", " ")
    }));

    const subject = `Meeting Minutes: ${meeting.title}`;
    const body = this.generateEmailBody(meeting);

    if (this.useMockServices) {
      this.logEmailToConsole(recipients, subject, body, attachments);
      return;
    }

    await this.sendViaGraphAPI(recipients, subject, body, attachments);
  }

  /**
   * Send approval notification to specific user
   */
  async sendApprovalNotification(
    recipientEmail: string,
    meeting: MeetingWithMinutes
  ): Promise<void> {
    const subject = `Action Required: Approve Meeting Minutes - ${meeting.title}`;
    const body = this.generateApprovalEmailBody(meeting);

    if (this.useMockServices) {
      this.logEmailToConsole([{ email: recipientEmail }], subject, body, []);
      return;
    }

    await this.sendViaGraphAPI([{ email: recipientEmail }], subject, body, []);
  }

  /**
   * Send via Microsoft Graph API (production)
   */
  private async sendViaGraphAPI(
    recipients: EmailRecipient[],
    subject: string,
    body: string,
    attachments: EmailAttachment[]
  ): Promise<void> {
    const config = getConfig();
    const senderEmail = config.email.senderEmail;

    if (!senderEmail) {
      throw new Error('GRAPH_SENDER_EMAIL environment variable not configured');
    }

    console.log(`📧 [Email Service] Sending email via Microsoft Graph API`);
    console.log(`   From: ${senderEmail}`);
    console.log(`   To: ${recipients.map(r => r.email).join(", ")}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Attachments: ${attachments.length}`);

    try {
      // Step 1: Acquire app-only access token for Graph API
      const accessToken = await acquireTokenByClientCredentials([
        'https://graph.microsoft.com/.default'
      ]);

      if (!accessToken) {
        throw new Error('Failed to acquire access token for Microsoft Graph API');
      }

      // Step 2: Build email message payload
      const message = {
        message: {
          subject,
          body: {
            contentType: "HTML",
            content: body
          },
          toRecipients: recipients.map(r => ({
            emailAddress: {
              address: r.email,
              name: r.name || r.email
            }
          })),
          attachments: attachments.map(att => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: att.filename,
            contentType: att.contentType,
            contentBytes: att.content.toString("base64")
          }))
        },
        saveToSentItems: true
      };

      // Step 3: Send email via Graph API /users/{userId}/sendMail endpoint
      const response = await fetch(
        `${this.graphApiEndpoint}/users/${senderEmail}/sendMail`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(message)
        }
      );

      // Step 4: Handle response
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Graph API error (${response.status})`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(`Failed to send email via Graph API: ${errorMessage}`);
      }

      console.log(`✅ [Email Service] Email sent successfully to ${recipients.length} recipient(s)`);
    } catch (error) {
      console.error(`❌ [Email Service] Failed to send email:`, error instanceof Error ? error.message : 'Unknown error');
      throw error; // Re-throw to allow retry logic in durable queue
    }
  }

  /**
   * Development fallback - log to console
   */
  private logEmailToConsole(
    recipients: EmailRecipient[],
    subject: string,
    body: string,
    attachments: EmailAttachment[]
  ): void {
    console.log("\n" + "=".repeat(80));
    console.log("📧 EMAIL DISTRIBUTION (Development Mode - Not Actually Sent)");
    console.log("=".repeat(80));
    console.log(`To: ${recipients.map(r => r.email).join(", ")}`);
    console.log(`Subject: ${subject}`);
    console.log("-".repeat(80));
    console.log(body);
    console.log("-".repeat(80));
    if (attachments.length > 0) {
      console.log(`Attachments: ${attachments.map(a => a.filename).join(", ")}`);
    }
    console.log("=".repeat(80) + "\n");
  }

  /**
   * Generate HTML email body for meeting minutes distribution
   */
  private generateEmailBody(meeting: MeetingWithMinutes): string {
    if (!meeting.minutes) return "";

    const classificationColor = meeting.classificationLevel === "UNCLASSIFIED" 
      ? "#008000" 
      : meeting.classificationLevel === "CONFIDENTIAL"
      ? "#00008B"
      : "#8B0000";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .classification { 
      background-color: ${classificationColor}15; 
      color: ${classificationColor}; 
      padding: 12px; 
      text-align: center; 
      font-weight: bold; 
      border: 2px solid ${classificationColor};
      margin-bottom: 20px;
    }
    .header { background-color: #f4f4f4; padding: 20px; border-left: 4px solid #0078d4; }
    .section { margin: 20px 0; }
    .section-title { color: #0078d4; font-weight: bold; margin-bottom: 10px; }
    ul { margin: 10px 0; padding-left: 20px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="classification">${meeting.classificationLevel}</div>
  
  <div class="header">
    <h2>Meeting Minutes</h2>
    <p><strong>Title:</strong> ${meeting.title}</p>
    <p><strong>Date:</strong> ${format(new Date(meeting.scheduledAt), "MMMM dd, yyyy 'at' HH:mm")}</p>
    <p><strong>Duration:</strong> ${meeting.duration}</p>
  </div>

  <div class="section">
    <div class="section-title">EXECUTIVE SUMMARY</div>
    <p>${meeting.minutes.summary}</p>
  </div>

  <div class="section">
    <div class="section-title">KEY DISCUSSIONS</div>
    <ul>
      ${meeting.minutes.keyDiscussions.map(d => `<li>${d}</li>`).join("")}
    </ul>
  </div>

  <div class="section">
    <div class="section-title">DECISIONS MADE</div>
    <ul>
      ${meeting.minutes.decisions.map(d => `<li>${d}</li>`).join("")}
    </ul>
  </div>

  ${meeting.actionItems && meeting.actionItems.length > 0 ? `
  <div class="section">
    <div class="section-title">ACTION ITEMS</div>
    <ul>
      ${meeting.actionItems.map(item => `
        <li>
          <strong>${item.task}</strong><br/>
          Assigned to: ${item.assignee} | 
          Due: ${item.dueDate ? format(new Date(item.dueDate), "MMM dd, yyyy") : "TBD"} |
          Priority: ${item.priority.toUpperCase()}
        </li>
      `).join("")}
    </ul>
  </div>
  ` : ""}

  <div class="footer">
    <p>This is an automated distribution from the Teams Meeting Minutes System.</p>
    <p>Documents are attached in DOCX and PDF formats.</p>
    <p><strong>Classification:</strong> ${meeting.classificationLevel}</p>
  </div>

  <div class="classification">${meeting.classificationLevel}</div>
</body>
</html>
    `.trim();
  }

  /**
   * Send support request email to configured support address
   */
  async sendSupportRequest(request: {
    userEmail: string;
    userName: string;
    subject: string;
    category: string;
    description: string;
  }): Promise<void> {
    const supportEmail = process.env.SUPPORT_EMAIL;
    if (!supportEmail) {
      console.warn("[Email] SUPPORT_EMAIL not configured, skipping email notification");
      return;
    }

    const emailSubject = `[Help Request] ${request.category}: ${request.subject}`;
    const body = this.generateSupportRequestBody(request);

    const recipients: EmailRecipient[] = [{ email: supportEmail, name: "Support Team" }];

    if (this.useMockServices) {
      this.logEmailToConsole(recipients, emailSubject, body, []);
      return;
    }

    await this.sendViaGraphAPI(recipients, emailSubject, body, []);
  }

  /**
   * Generate email body for support request
   */
  private generateSupportRequestBody(request: {
    userEmail: string;
    userName: string;
    subject: string;
    category: string;
    description: string;
  }): string {
    const timestamp = format(new Date(), "MMMM dd, yyyy 'at' HH:mm");
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background-color: #0078d4; color: white; padding: 20px; }
    .content { padding: 20px; background-color: #f8f9fa; }
    .field { margin-bottom: 15px; }
    .field-label { font-weight: bold; color: #333; }
    .field-value { background-color: white; padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; margin-top: 5px; }
    .description { white-space: pre-wrap; }
    .footer { padding: 15px; font-size: 12px; color: #666; border-top: 1px solid #dee2e6; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">Meeting Minutes - Help Request</h2>
  </div>
  
  <div class="content">
    <div class="field">
      <div class="field-label">From:</div>
      <div class="field-value">${request.userName} (${request.userEmail})</div>
    </div>
    
    <div class="field">
      <div class="field-label">Category:</div>
      <div class="field-value">${request.category}</div>
    </div>
    
    <div class="field">
      <div class="field-label">Subject:</div>
      <div class="field-value">${request.subject}</div>
    </div>
    
    <div class="field">
      <div class="field-label">Description:</div>
      <div class="field-value description">${request.description}</div>
    </div>
    
    <div class="field">
      <div class="field-label">Submitted:</div>
      <div class="field-value">${timestamp}</div>
    </div>
  </div>
  
  <div class="footer">
    <p>This is an automated message from the Meeting Minutes Help System.</p>
    <p>Reply directly to this email to respond to the user.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate email body for approval notification
   */
  private generateApprovalEmailBody(meeting: MeetingWithMinutes): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #fff3cd; padding: 20px; border-left: 4px solid #ffc107; }
    .action-required { background-color: #ffc107; color: #000; padding: 15px; text-align: center; font-weight: bold; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="action-required">⚠️ ACTION REQUIRED: MEETING MINUTES APPROVAL</div>
  
  <div class="header">
    <h2>Meeting Minutes Awaiting Approval</h2>
    <p><strong>Meeting:</strong> ${meeting.title}</p>
    <p><strong>Date:</strong> ${format(new Date(meeting.scheduledAt), "MMMM dd, yyyy")}</p>
  </div>

  <p>Meeting minutes have been automatically generated and require your review and approval before distribution.</p>
  
  <p>Please log into the Meeting Minutes System to:</p>
  <ul>
    <li>Review the generated minutes</li>
    <li>Approve or request revisions</li>
    <li>Authorize distribution to attendees</li>
  </ul>

  <p><strong>Note:</strong> Minutes will not be distributed until approved.</p>
</body>
</html>
    `.trim();
  }
}

export const emailDistributionService = new EmailDistributionService();
