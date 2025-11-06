import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  Packer,
  Header,
  Footer
} from "docx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { MeetingWithMinutes } from "@shared/schema";
import { format } from "date-fns";

/**
 * DOD-compliant document export service
 * Generates DOCX and PDF documents with proper classification headers
 */

interface ClassificationConfig {
  label: string;
  color: { r: number; g: number; b: number };
  backgroundColor: { r: number; g: number; b: number };
}

const CLASSIFICATION_CONFIGS: Record<string, ClassificationConfig> = {
  UNCLASSIFIED: {
    label: "UNCLASSIFIED",
    color: { r: 0, g: 100, b: 0 },
    backgroundColor: { r: 240, g: 255, b: 240 }
  },
  CONFIDENTIAL: {
    label: "CONFIDENTIAL",
    color: { r: 0, g: 0, b: 139 },
    backgroundColor: { r: 230, g: 230, b: 255 }
  },
  SECRET: {
    label: "SECRET",
    color: { r: 139, g: 0, b: 0 },
    backgroundColor: { r: 255, g: 230, b: 230 }
  }
};

export class DocumentExportService {
  /**
   * Generate DOCX document for meeting minutes
   */
  async generateDOCX(meeting: MeetingWithMinutes): Promise<Buffer> {
    if (!meeting.minutes) {
      throw new Error("Meeting has no minutes to export");
    }

    const classification = CLASSIFICATION_CONFIGS[meeting.classificationLevel] || CLASSIFICATION_CONFIGS.UNCLASSIFIED;
    
    const doc = new Document({
      sections: [{
        properties: {},
        headers: {
          default: new Header({
            children: [new Paragraph({
              children: [new TextRun(classification.label)],
              alignment: AlignmentType.CENTER,
              border: {
                bottom: {
                  color: "000000",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
              spacing: { after: 200 },
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              children: [new TextRun(classification.label)],
              alignment: AlignmentType.CENTER,
              border: {
                top: {
                  color: "000000",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
              spacing: { before: 200 },
            })],
          }),
        },
        children: [
          // Title
          new Paragraph({
            text: "MEETING MINUTES",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          // Meeting Details Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ 
                      children: [new TextRun({ text: "Meeting Title:", bold: true })]
                    })],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: meeting.title })],
                    width: { size: 70, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: "Date/Time:", bold: true })]
                    })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: format(new Date(meeting.scheduledAt), "MMMM dd, yyyy 'at' HH:mm") 
                    })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: "Duration:", bold: true })]
                    })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: meeting.duration })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: "Classification:", bold: true })]
                    })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: meeting.classificationLevel })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Attendees
          new Paragraph({
            text: "ATTENDEES",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }),
          ...meeting.minutes.attendeesPresent.map(attendee => 
            new Paragraph({
              text: `• ${attendee}`,
              spacing: { after: 100 },
            })
          ),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Summary
          new Paragraph({
            text: "EXECUTIVE SUMMARY",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: meeting.minutes.summary,
            spacing: { after: 300 },
          }),

          // Key Discussions
          new Paragraph({
            text: "KEY DISCUSSIONS",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }),
          ...meeting.minutes.keyDiscussions.map(discussion => 
            new Paragraph({
              text: `• ${discussion}`,
              spacing: { after: 100 },
            })
          ),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Decisions
          new Paragraph({
            text: "DECISIONS MADE",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }),
          ...meeting.minutes.decisions.map(decision => 
            new Paragraph({
              text: `• ${decision}`,
              spacing: { after: 100 },
            })
          ),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Action Items
          new Paragraph({
            text: "ACTION ITEMS",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }),
          ...(meeting.actionItems && meeting.actionItems.length > 0
            ? meeting.actionItems.map(item => 
                new Paragraph({
                  text: `• ${item.task} (Assigned to: ${item.assignee}, Due: ${item.dueDate ? format(new Date(item.dueDate), "MMM dd, yyyy") : "TBD"})`,
                  spacing: { after: 100 },
                })
              )
            : [new Paragraph({
                children: [new TextRun({ text: "No action items recorded.", italics: true })],
              })]
          ),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Footer metadata
          new Paragraph({
            text: `Document generated: ${format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}`,
            alignment: AlignmentType.CENTER,
            spacing: { before: 600 },
          }),
        ],
      }],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Generate PDF document for meeting minutes with proper pagination
   */
  async generatePDF(meeting: MeetingWithMinutes): Promise<Buffer> {
    if (!meeting.minutes) {
      throw new Error("Meeting has no minutes to export");
    }

    const classification = CLASSIFICATION_CONFIGS[meeting.classificationLevel] || CLASSIFICATION_CONFIGS.UNCLASSIFIED;
    const pdfDoc = await PDFDocument.create();
    
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const topMargin = 70; // Space for classification header
    const bottomMargin = 70; // Space for classification footer
    const lineHeight = 15;
    const maxWidth = pageWidth - (2 * margin);

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - topMargin;

    // Helper to add classification header
    const addClassificationHeader = (page: any) => {
      page.drawRectangle({
        x: 0,
        y: pageHeight - 30,
        width: pageWidth,
        height: 30,
        color: rgb(
          classification.backgroundColor.r / 255,
          classification.backgroundColor.g / 255,
          classification.backgroundColor.b / 255
        ),
      });
      page.drawText(classification.label, {
        x: pageWidth / 2 - (classification.label.length * 6),
        y: pageHeight - 22,
        size: 12,
        font: fontBold,
        color: rgb(
          classification.color.r / 255,
          classification.color.g / 255,
          classification.color.b / 255
        ),
      });
    };

    // Helper to add classification footer
    const addClassificationFooter = (page: any) => {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: 30,
        color: rgb(
          classification.backgroundColor.r / 255,
          classification.backgroundColor.g / 255,
          classification.backgroundColor.b / 255
        ),
      });
      page.drawText(classification.label, {
        x: pageWidth / 2 - (classification.label.length * 6),
        y: 10,
        size: 12,
        font: fontBold,
        color: rgb(
          classification.color.r / 255,
          classification.color.g / 255,
          classification.color.b / 255
        ),
      });
    };

    // Add header and footer to first page
    addClassificationHeader(currentPage);
    addClassificationFooter(currentPage);

    // Helper to check if we need a new page
    const checkNewPage = (requiredSpace: number) => {
      if (yPosition - requiredSpace < bottomMargin) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        addClassificationHeader(currentPage);
        addClassificationFooter(currentPage);
        yPosition = pageHeight - topMargin;
      }
    };

    // Helper to add text with automatic page breaks
    const addText = (text: string, fontSize: number, font: any, color = rgb(0, 0, 0), indent = 0) => {
      const lines = this.wrapTextPDF(text, maxWidth - indent, fontSize, font);
      lines.forEach(line => {
        checkNewPage(fontSize + 5);
        currentPage.drawText(line, {
          x: margin + indent,
          y: yPosition,
          size: fontSize,
          font,
          color,
        });
        yPosition -= fontSize + 5;
      });
    };

    // Title
    checkNewPage(30);
    currentPage.drawText("MEETING MINUTES", {
      x: pageWidth / 2 - 70,
      y: yPosition,
      size: 18,
      font: fontBold,
    });
    yPosition -= 40;

    // Meeting details
    addText(`Meeting Title: ${meeting.title}`, 11, fontBold);
    addText(`Date/Time: ${format(new Date(meeting.scheduledAt), "MMMM dd, yyyy 'at' HH:mm")}`, 10, fontRegular);
    addText(`Duration: ${meeting.duration}`, 10, fontRegular);
    addText(`Classification: ${meeting.classificationLevel}`, 10, fontBold, rgb(
      classification.color.r / 255,
      classification.color.g / 255,
      classification.color.b / 255
    ));
    yPosition -= 10;

    // Attendees
    addText("ATTENDEES", 12, fontBold);
    if (meeting.minutes.attendeesPresent && meeting.minutes.attendeesPresent.length > 0) {
      meeting.minutes.attendeesPresent.forEach(attendee => {
        addText(`• ${attendee}`, 9, fontRegular, rgb(0, 0, 0), 10);
      });
    }
    yPosition -= 10;

    // Summary
    addText("EXECUTIVE SUMMARY", 12, fontBold);
    if (meeting.minutes.summary) {
      addText(meeting.minutes.summary, 9, fontRegular);
    }
    yPosition -= 10;

    // Key Discussions
    addText("KEY DISCUSSIONS", 12, fontBold);
    if (meeting.minutes.keyDiscussions && meeting.minutes.keyDiscussions.length > 0) {
      meeting.minutes.keyDiscussions.forEach(discussion => {
        addText(`• ${discussion}`, 9, fontRegular, rgb(0, 0, 0), 10);
      });
    }
    yPosition -= 10;

    // Decisions
    addText("DECISIONS MADE", 12, fontBold);
    if (meeting.minutes.decisions && meeting.minutes.decisions.length > 0) {
      meeting.minutes.decisions.forEach(decision => {
        addText(`• ${decision}`, 9, fontRegular, rgb(0, 0, 0), 10);
      });
    }
    yPosition -= 10;

    // Action Items
    addText("ACTION ITEMS", 12, fontBold);
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      meeting.actionItems.forEach(item => {
        const itemText = `• ${item.task} (Assigned to: ${item.assignee}, Due: ${item.dueDate ? format(new Date(item.dueDate), "MMM dd, yyyy") : "TBD"})`;
        addText(itemText, 9, fontRegular, rgb(0, 0, 0), 10);
      });
    } else {
      addText("No action items recorded.", 9, fontRegular, rgb(0, 0, 0), 10);
    }

    // Generation timestamp
    checkNewPage(20);
    currentPage.drawText(`Generated: ${format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}`, {
      x: pageWidth / 2 - 80,
      y: bottomMargin - 15,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    return await pdfDoc.save();
  }

  /**
   * Helper to wrap text for PDF generation with font metrics
   */
  private wrapTextPDF(text: string, maxWidth: number, fontSize: number, font: any): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }
}

export const documentExportService = new DocumentExportService();
