import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, PageBreak } from 'docx';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface MarkdownSection {
  level: number;
  title: string;
  content: string[];
}

function parseMarkdown(content: string): MarkdownSection[] {
  const lines = content.split('\n');
  const sections: MarkdownSection[] = [];
  let currentSection: MarkdownSection | null = null;
  
  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);
    const h4Match = line.match(/^#### (.+)$/);
    
    if (h1Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { level: 1, title: h1Match[1], content: [] };
    } else if (h2Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { level: 2, title: h2Match[1], content: [] };
    } else if (h3Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { level: 3, title: h3Match[1], content: [] };
    } else if (h4Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { level: 4, title: h4Match[1], content: [] };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }
  
  if (currentSection) sections.push(currentSection);
  return sections;
}

function createTextRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: 'Consolas', shading: { fill: 'E0E0E0' } }));
    } else if (part) {
      runs.push(new TextRun({ text: part }));
    }
  }
  
  return runs.length ? runs : [new TextRun({ text: '' })];
}

function parseTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  const tableLines = lines.filter(l => l.includes('|') && l.trim().startsWith('|'));
  if (tableLines.length < 2) return null;
  
  const parseRow = (line: string) => 
    line.split('|').map(c => c.trim()).filter(c => c && !c.match(/^[-:]+$/));
  
  const headers = parseRow(tableLines[0]);
  const rows = tableLines.slice(2).map(parseRow).filter(r => r.length > 0);
  
  return { headers, rows };
}

function createTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
      shading: { fill: '0078D4' },
      width: { size: 100 / headers.length, type: WidthType.PERCENTAGE }
    }))
  });
  
  const dataRows = rows.map(row => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({ children: createTextRuns(cell) })],
      width: { size: 100 / headers.length, type: WidthType.PERCENTAGE }
    }))
  }));
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 }
    }
  });
}

function convertToDocx(markdownPath: string, outputPath: string, title: string) {
  console.log(`Converting ${markdownPath} to ${outputPath}...`);
  
  const content = readFileSync(markdownPath, 'utf-8');
  const sections = parseMarkdown(content);
  const children: (Paragraph | Table)[] = [];
  
  children.push(new Paragraph({
    text: title,
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 }
  }));
  
  children.push(new Paragraph({
    text: 'Teams Meeting Minutes Application',
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 }
  }));
  
  children.push(new Paragraph({
    text: 'Azure Commercial Cloud',
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 }
  }));
  
  children.push(new Paragraph({
    children: [new PageBreak()]
  }));
  
  for (const section of sections) {
    let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    switch (section.level) {
      case 1: heading = HeadingLevel.HEADING_1; break;
      case 2: heading = HeadingLevel.HEADING_2; break;
      case 3: heading = HeadingLevel.HEADING_3; break;
      default: heading = HeadingLevel.HEADING_4;
    }
    
    if (section.title && section.title !== title) {
      children.push(new Paragraph({
        text: section.title,
        heading,
        spacing: { before: 240, after: 120 }
      }));
    }
    
    const tableData = parseTable(section.content);
    if (tableData && tableData.headers.length > 0) {
      children.push(createTable(tableData.headers, tableData.rows));
      children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
    }
    
    let inCodeBlock = false;
    let codeContent: string[] = [];
    
    for (const line of section.content) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          children.push(new Paragraph({
            children: [new TextRun({ 
              text: codeContent.join('\n'), 
              font: 'Consolas',
              size: 20
            })],
            shading: { fill: 'F5F5F5' },
            spacing: { before: 120, after: 120 }
          }));
          codeContent = [];
        }
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }
      
      if (line.includes('|')) continue;
      if (line.startsWith('---')) continue;
      if (!line.trim()) continue;
      
      if (line.startsWith('- ') || line.match(/^\d+\. /)) {
        const bulletText = line.replace(/^[-\d.]+\s*/, '').trim();
        children.push(new Paragraph({
          children: createTextRuns(bulletText),
          bullet: { level: 0 },
          spacing: { after: 60 }
        }));
      } else {
        children.push(new Paragraph({
          children: createTextRuns(line),
          spacing: { after: 120 }
        }));
      }
    }
  }
  
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440
          }
        }
      },
      children
    }]
  });
  
  Packer.toBuffer(doc).then(buffer => {
    writeFileSync(outputPath, buffer);
    console.log(`Created ${outputPath}`);
  });
}

const docsDir = join(process.cwd(), 'docs');
const outputDir = join(docsDir, 'word');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const documents = [
  { input: 'USER_GUIDE.md', output: 'User_Guide.docx', title: 'User Guide' },
  { input: 'ADMIN_GUIDE.md', output: 'Administrator_Guide.docx', title: 'Administrator Guide' },
  { input: 'DEVELOPER_GUIDE.md', output: 'Developer_Guide.docx', title: 'Developer Guide' },
  { input: 'INSTALLATION_MANUAL.md', output: 'Installation_Manual.docx', title: 'Installation Manual' },
  { input: 'TROUBLESHOOTING_GUIDE.md', output: 'Troubleshooting_Guide.docx', title: 'Troubleshooting Guide' }
];

console.log('Converting documentation to Word format...\n');

for (const doc of documents) {
  const inputPath = join(docsDir, doc.input);
  const outputPath = join(outputDir, doc.output);
  
  if (existsSync(inputPath)) {
    convertToDocx(inputPath, outputPath, doc.title);
  } else {
    console.warn(`Warning: ${inputPath} not found`);
  }
}

console.log('\nConversion complete!');
