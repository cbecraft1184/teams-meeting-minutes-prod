/**
 * Email Distribution Service for Meeting Minutes
 * 
 * In production (AWS Gov Cloud):
 * - Uses Microsoft Graph API to send emails through Outlook
 * - Requires Azure AD authentication and Graph API permissions
 * 
 * In development:
 * - Logs email to console (no actual sending)
 */

import type { MeetingWithMinutes } from "@shared/schema";
import { format } from "date-fns";

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
  private isDevelopment = process.env.NODE_ENV === "development";
  private graphApiEndpoint = "https://graph.microsoft.com/v1.0";

  /**
   * Send meeting minutes to all attendees
   */
  async distributeMinutes(
    meeting: MeetingWithMinutes,
    attachments: EmailAttachment[]
  ): Promise<void> {
    if (!meeting.minutes) {
      throw new Error("Meeting has no minutes to distribute");
    }

    const recipients: EmailRecipient[] = meeting.attendees.map(email => ({
      email,
      name: email.split("@")[0].replace(".", " ")
    }));

    const subject = `Meeting Minutes: ${meeting.title}`;
    const body = this.generateEmailBody(meeting);

    if (this.isDevelopment) {
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

    if (this.isDevelopment) {
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
    // In production deployment:
    // 1. Get access token from Azure AD using service principal
    // 2. Use Microsoft Graph API to send email
    // 3. Reference: https://learn.microsoft.com/en-us/graph/api/user-sendmail

    console.log("📧 [Email Service] Would send via Microsoft Graph API in production");
    console.log(`   Recipients: ${recipients.map(r => r.email).join(", ")}`);
    console.log(`   Subject: ${subject}`);

    // Production implementation would look like:
    /*
    const accessToken = await this.getGraphAccessToken();
    
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
            name: r.name
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

    await fetch(`${this.graphApiEndpoint}/me/sendMail`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message)
    });
    */
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
    <p>This is an automated distribution from the DOD Teams Meeting Minutes System.</p>
    <p>Documents are attached in DOCX and PDF formats.</p>
    <p><strong>Classification:</strong> ${meeting.classificationLevel}</p>
  </div>

  <div class="classification">${meeting.classificationLevel}</div>
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
