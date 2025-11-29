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
  Footer,
  PageNumber,
  NumberFormat
} from "docx";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import type { MeetingWithMinutes, DocumentTemplateConfig, DocumentSection } from "@shared/schema";
import { format } from "date-fns";
import { templateService } from "./templateService";

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
  private async getTemplateConfig(templateId?: string): Promise<DocumentTemplateConfig> {
    if (templateId) {
      const template = await templateService.getTemplateById(templateId);
      if (template) {
        return templateService.parseConfig(template);
      }
    }
    
    const defaultTemplate = await templateService.getDefaultTemplate();
    if (defaultTemplate) {
      return templateService.parseConfig(defaultTemplate);
    }
    
    return templateService.getDefaultConfig();
  }

  private getEnabledSections(config: DocumentTemplateConfig): DocumentSection[] {
    return config.sections
      .filter(section => section.enabled)
      .sort((a, b) => a.order - b.order);
  }

  async generateDOCX(meeting: MeetingWithMinutes, templateId?: string): Promise<Buffer> {
    if (!meeting.minutes) {
      throw new Error("Meeting has no minutes to export");
    }

    const config = await this.getTemplateConfig(templateId);
    const classification = CLASSIFICATION_CONFIGS[meeting.classificationLevel] || CLASSIFICATION_CONFIGS.UNCLASSIFIED;
    const enabledSections = this.getEnabledSections(config);
    
    const headerContent: Paragraph[] = [];
    const footerContent: Paragraph[] = [];

    headerContent.push(new Paragraph({
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
    }));

    if (config.headerText) {
      headerContent.push(new Paragraph({
        children: [new TextRun({ text: config.headerText, size: 18 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }));
    }

    footerContent.push(new Paragraph({
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
    }));

    if (config.footerText) {
      footerContent.push(new Paragraph({
        children: [new TextRun({ text: config.footerText, size: 18 })],
        alignment: AlignmentType.CENTER,
      }));
    }

    if (config.showPageNumbers) {
      footerContent.push(new Paragraph({
        children: [
          new TextRun({ text: "Page " }),
          new TextRun({ children: [PageNumber.CURRENT] }),
          new TextRun({ text: " of " }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
      }));
    }

    const documentChildren: Paragraph[] | Table[] = [];

    for (const section of enabledSections) {
      switch (section.id) {
        case 'title':
          documentChildren.push(new Paragraph({
            text: "MEETING MINUTES",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }));
          if (config.branding.organizationName) {
            documentChildren.push(new Paragraph({
              text: config.branding.organizationName,
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            }));
          }
          break;

        case 'details':
          documentChildren.push(new Table({
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
          }));
          documentChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));
          break;

        case 'attendees':
          documentChildren.push(new Paragraph({
            text: "ATTENDEES",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }));
          meeting.minutes.attendeesPresent.forEach(attendee => {
            documentChildren.push(new Paragraph({
              text: `• ${attendee}`,
              spacing: { after: 100 },
            }));
          });
          documentChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));
          break;

        case 'summary':
          documentChildren.push(new Paragraph({
            text: "EXECUTIVE SUMMARY",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }));
          documentChildren.push(new Paragraph({
            text: meeting.minutes.summary,
            spacing: { after: 300 },
          }));
          break;

        case 'discussions':
          documentChildren.push(new Paragraph({
            text: "KEY DISCUSSIONS",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }));
          meeting.minutes.keyDiscussions.forEach(discussion => {
            documentChildren.push(new Paragraph({
              text: `• ${discussion}`,
              spacing: { after: 100 },
            }));
          });
          documentChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));
          break;

        case 'decisions':
          documentChildren.push(new Paragraph({
            text: "DECISIONS MADE",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }));
          meeting.minutes.decisions.forEach(decision => {
            documentChildren.push(new Paragraph({
              text: `• ${decision}`,
              spacing: { after: 100 },
            }));
          });
          documentChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));
          break;

        case 'actionItems':
          documentChildren.push(new Paragraph({
            text: "ACTION ITEMS",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
          }));
          if (meeting.actionItems && meeting.actionItems.length > 0) {
            meeting.actionItems.forEach(item => {
              documentChildren.push(new Paragraph({
                text: `• ${item.task} (Assigned to: ${item.assignee}, Due: ${item.dueDate ? format(new Date(item.dueDate), "MMM dd, yyyy") : "TBD"})`,
                spacing: { after: 100 },
              }));
            });
          } else {
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: "No action items recorded.", italics: true })],
            }));
          }
          documentChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));
          break;
      }
    }

    if (config.showGeneratedDate) {
      documentChildren.push(new Paragraph({
        text: `Document generated: ${format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}`,
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
      }));
    }

    const doc = new Document({
      sections: [{
        properties: {},
        headers: {
          default: new Header({
            children: headerContent,
          }),
        },
        footers: {
          default: new Footer({
            children: footerContent,
          }),
        },
        children: documentChildren as any,
      }],
    });

    return await Packer.toBuffer(doc);
  }

  async generatePDF(meeting: MeetingWithMinutes, templateId?: string): Promise<Buffer> {
    if (!meeting.minutes) {
      throw new Error("Meeting has no minutes to export");
    }

    const config = await this.getTemplateConfig(templateId);
    const classification = CLASSIFICATION_CONFIGS[meeting.classificationLevel] || CLASSIFICATION_CONFIGS.UNCLASSIFIED;
    const enabledSections = this.getEnabledSections(config);
    
    const pdfDoc = await PDFDocument.create();
    
    const fonts = await this.loadFonts(pdfDoc, config.styling.fontFamily);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const topMargin = 70;
    const bottomMargin = 70;
    const maxWidth = pageWidth - (2 * margin);

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - topMargin;
    let pageNumber = 1;

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
        font: fonts.bold,
        color: rgb(
          classification.color.r / 255,
          classification.color.g / 255,
          classification.color.b / 255
        ),
      });

      if (config.headerText) {
        page.drawText(config.headerText, {
          x: margin,
          y: pageHeight - 45,
          size: 9,
          font: fonts.regular,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
    };

    const addClassificationFooter = (page: any, pgNum: number) => {
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
        font: fonts.bold,
        color: rgb(
          classification.color.r / 255,
          classification.color.g / 255,
          classification.color.b / 255
        ),
      });

      if (config.showPageNumbers) {
        page.drawText(`Page ${pgNum}`, {
          x: pageWidth - margin - 40,
          y: 35,
          size: 9,
          font: fonts.regular,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      if (config.footerText) {
        page.drawText(config.footerText, {
          x: margin,
          y: 35,
          size: 9,
          font: fonts.regular,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
    };

    addClassificationHeader(currentPage);
    addClassificationFooter(currentPage, pageNumber);

    const checkNewPage = (requiredSpace: number) => {
      if (yPosition - requiredSpace < bottomMargin + 20) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        pageNumber++;
        addClassificationHeader(currentPage);
        addClassificationFooter(currentPage, pageNumber);
        yPosition = pageHeight - topMargin;
      }
    };

    const addText = (text: string, fontSize: number, font: PDFFont, color = rgb(0, 0, 0), indent = 0) => {
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
        yPosition -= fontSize * config.styling.lineSpacing;
      });
    };

    for (const section of enabledSections) {
      switch (section.id) {
        case 'title':
          checkNewPage(50);
          currentPage.drawText("MEETING MINUTES", {
            x: pageWidth / 2 - 70,
            y: yPosition,
            size: config.styling.titleSize,
            font: fonts.bold,
          });
          yPosition -= config.styling.titleSize + 10;
          
          if (config.branding.organizationName) {
            currentPage.drawText(config.branding.organizationName, {
              x: pageWidth / 2 - (config.branding.organizationName.length * 3.5),
              y: yPosition,
              size: 12,
              font: fonts.regular,
              color: rgb(0.3, 0.3, 0.3),
            });
            yPosition -= 20;
          }
          yPosition -= 15;
          break;

        case 'details':
          addText(`Meeting Title: ${meeting.title}`, config.styling.bodySize, fonts.bold);
          addText(`Date/Time: ${format(new Date(meeting.scheduledAt), "MMMM dd, yyyy 'at' HH:mm")}`, config.styling.bodySize - 1, fonts.regular);
          addText(`Duration: ${meeting.duration}`, config.styling.bodySize - 1, fonts.regular);
          addText(`Classification: ${meeting.classificationLevel}`, config.styling.bodySize, fonts.bold, rgb(
            classification.color.r / 255,
            classification.color.g / 255,
            classification.color.b / 255
          ));
          yPosition -= 10;
          break;

        case 'attendees':
          addText("ATTENDEES", config.styling.headingSize, fonts.bold);
          yPosition -= 5;
          if (meeting.minutes.attendeesPresent && meeting.minutes.attendeesPresent.length > 0) {
            meeting.minutes.attendeesPresent.forEach(attendee => {
              addText(`• ${attendee}`, config.styling.bodySize - 2, fonts.regular, rgb(0, 0, 0), 10);
            });
          }
          yPosition -= 10;
          break;

        case 'summary':
          addText("EXECUTIVE SUMMARY", config.styling.headingSize, fonts.bold);
          yPosition -= 5;
          if (meeting.minutes.summary) {
            addText(meeting.minutes.summary, config.styling.bodySize - 2, fonts.regular);
          }
          yPosition -= 10;
          break;

        case 'discussions':
          addText("KEY DISCUSSIONS", config.styling.headingSize, fonts.bold);
          yPosition -= 5;
          if (meeting.minutes.keyDiscussions && meeting.minutes.keyDiscussions.length > 0) {
            meeting.minutes.keyDiscussions.forEach(discussion => {
              addText(`• ${discussion}`, config.styling.bodySize - 2, fonts.regular, rgb(0, 0, 0), 10);
            });
          }
          yPosition -= 10;
          break;

        case 'decisions':
          addText("DECISIONS MADE", config.styling.headingSize, fonts.bold);
          yPosition -= 5;
          if (meeting.minutes.decisions && meeting.minutes.decisions.length > 0) {
            meeting.minutes.decisions.forEach(decision => {
              addText(`• ${decision}`, config.styling.bodySize - 2, fonts.regular, rgb(0, 0, 0), 10);
            });
          }
          yPosition -= 10;
          break;

        case 'actionItems':
          addText("ACTION ITEMS", config.styling.headingSize, fonts.bold);
          yPosition -= 5;
          if (meeting.actionItems && meeting.actionItems.length > 0) {
            meeting.actionItems.forEach(item => {
              const itemText = `• ${item.task} (Assigned to: ${item.assignee}, Due: ${item.dueDate ? format(new Date(item.dueDate), "MMM dd, yyyy") : "TBD"})`;
              addText(itemText, config.styling.bodySize - 2, fonts.regular, rgb(0, 0, 0), 10);
            });
          } else {
            addText("No action items recorded.", config.styling.bodySize - 2, fonts.regular, rgb(0, 0, 0), 10);
          }
          break;
      }
    }

    if (config.showGeneratedDate) {
      checkNewPage(20);
      currentPage.drawText(`Generated: ${format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}`, {
        x: pageWidth / 2 - 80,
        y: bottomMargin + 25,
        size: 8,
        font: fonts.regular,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    return Buffer.from(await pdfDoc.save());
  }

  private async loadFonts(pdfDoc: PDFDocument, fontFamily: "helvetica" | "times" | "courier"): Promise<{ regular: PDFFont; bold: PDFFont }> {
    switch (fontFamily) {
      case 'times':
        return {
          regular: await pdfDoc.embedFont(StandardFonts.TimesRoman),
          bold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
        };
      case 'courier':
        return {
          regular: await pdfDoc.embedFont(StandardFonts.Courier),
          bold: await pdfDoc.embedFont(StandardFonts.CourierBold),
        };
      case 'helvetica':
      default:
        return {
          regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
          bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        };
    }
  }

  private wrapTextPDF(text: string, maxWidth: number, fontSize: number, font: PDFFont): string[] {
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
