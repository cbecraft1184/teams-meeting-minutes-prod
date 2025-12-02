import { db } from '../db';
import { 
  documentTemplates, 
  DocumentTemplate, 
  InsertDocumentTemplate,
  DocumentTemplateConfig,
  DocumentSection,
  DocumentBranding,
  DocumentStyling
} from '@shared/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_CONFIG: DocumentTemplateConfig = {
  sections: [
    { id: 'title', name: 'Title Page', enabled: true, order: 1 },
    { id: 'details', name: 'Meeting Details', enabled: true, order: 2 },
    { id: 'attendees', name: 'Attendees', enabled: true, order: 3 },
    { id: 'summary', name: 'Executive Summary', enabled: true, order: 4 },
    { id: 'discussions', name: 'Key Discussions', enabled: true, order: 5 },
    { id: 'decisions', name: 'Decisions', enabled: true, order: 6 },
    { id: 'actionItems', name: 'Action Items', enabled: true, order: 7 },
  ],
  branding: {
    organizationName: '',
    logoEnabled: false,
    primaryColor: '#0078D4',
    secondaryColor: '#106EBE',
  },
  styling: {
    fontFamily: 'helvetica',
    titleSize: 18,
    headingSize: 14,
    bodySize: 11,
    lineSpacing: 1.15,
  },
  headerText: '',
  footerText: '',
  showPageNumbers: true,
  showGeneratedDate: true,
};

class TemplateService {
  async getAllTemplates(): Promise<DocumentTemplate[]> {
    return db.select().from(documentTemplates).orderBy(documentTemplates.name);
  }

  async getTemplateById(id: string): Promise<DocumentTemplate | null> {
    const [template] = await db
      .select()
      .from(documentTemplates)
      .where(eq(documentTemplates.id, id))
      .limit(1);
    return template || null;
  }

  async getDefaultTemplate(): Promise<DocumentTemplate | null> {
    const [template] = await db
      .select()
      .from(documentTemplates)
      .where(eq(documentTemplates.isDefault, true))
      .limit(1);
    return template || null;
  }

  async createTemplate(data: {
    name: string;
    description?: string;
    config?: Partial<DocumentTemplateConfig>;
  }): Promise<DocumentTemplate> {
    const config = this.mergeWithDefaults(data.config || {});
    
    const [template] = await db
      .insert(documentTemplates)
      .values({
        name: data.name,
        description: data.description || null,
        isDefault: false,
        isSystem: false,
        config,
      })
      .returning();
    
    return template;
  }

  async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      config?: Partial<DocumentTemplateConfig>;
    }
  ): Promise<DocumentTemplate | null> {
    const existing = await this.getTemplateById(id);
    if (!existing) return null;

    const updateValues: Record<string, unknown> = {};

    if (data.name) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.config) {
      const existingConfig = existing.config;
      updateValues.config = this.mergeConfigs(existingConfig, data.config);
    }

    const [updated] = await db
      .update(documentTemplates)
      .set(updateValues)
      .where(eq(documentTemplates.id, id))
      .returning();

    return updated || null;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const existing = await this.getTemplateById(id);
    if (!existing) return false;
    
    if (existing.isSystem) {
      throw new Error('Cannot delete system templates');
    }

    await db.delete(documentTemplates).where(eq(documentTemplates.id, id));
    return true;
  }

  async setDefaultTemplate(id: string): Promise<boolean> {
    const existing = await this.getTemplateById(id);
    if (!existing) return false;

    await db
      .update(documentTemplates)
      .set({ isDefault: false })
      .where(eq(documentTemplates.isDefault, true));

    await db
      .update(documentTemplates)
      .set({ isDefault: true })
      .where(eq(documentTemplates.id, id));

    return true;
  }

  async duplicateTemplate(id: string, newName: string): Promise<DocumentTemplate | null> {
    const existing = await this.getTemplateById(id);
    if (!existing) return null;

    const [duplicate] = await db
      .insert(documentTemplates)
      .values({
        name: newName,
        description: existing.description ? `Copy of ${existing.description}` : null,
        isDefault: false,
        isSystem: false,
        config: existing.config,
      })
      .returning();

    return duplicate;
  }

  getDefaultConfig(): DocumentTemplateConfig {
    return { ...DEFAULT_CONFIG };
  }

  parseConfig(template: DocumentTemplate): DocumentTemplateConfig {
    return this.mergeWithDefaults(template.config);
  }

  private mergeWithDefaults(partial: Partial<DocumentTemplateConfig>): DocumentTemplateConfig {
    const fontFamily = partial.styling?.fontFamily || DEFAULT_CONFIG.styling.fontFamily;
    const validFontFamily: "helvetica" | "times" | "courier" = 
      ['helvetica', 'times', 'courier'].includes(fontFamily) 
        ? (fontFamily as "helvetica" | "times" | "courier") 
        : 'helvetica';

    return {
      sections: partial.sections || DEFAULT_CONFIG.sections,
      branding: { ...DEFAULT_CONFIG.branding, ...(partial.branding || {}) },
      styling: { 
        ...DEFAULT_CONFIG.styling, 
        ...(partial.styling || {}),
        fontFamily: validFontFamily
      },
      headerText: partial.headerText ?? DEFAULT_CONFIG.headerText,
      footerText: partial.footerText ?? DEFAULT_CONFIG.footerText,
      showPageNumbers: partial.showPageNumbers ?? DEFAULT_CONFIG.showPageNumbers,
      showGeneratedDate: partial.showGeneratedDate ?? DEFAULT_CONFIG.showGeneratedDate,
    };
  }

  private mergeConfigs(existing: DocumentTemplateConfig, updates: Partial<DocumentTemplateConfig>): DocumentTemplateConfig {
    const fontFamily = updates.styling?.fontFamily || existing.styling.fontFamily;
    const validFontFamily: "helvetica" | "times" | "courier" = 
      ['helvetica', 'times', 'courier'].includes(fontFamily) 
        ? (fontFamily as "helvetica" | "times" | "courier") 
        : 'helvetica';

    return {
      sections: updates.sections || existing.sections,
      branding: { ...existing.branding, ...(updates.branding || {}) },
      styling: { 
        ...existing.styling, 
        ...(updates.styling || {}),
        fontFamily: validFontFamily
      },
      headerText: updates.headerText ?? existing.headerText,
      footerText: updates.footerText ?? existing.footerText,
      showPageNumbers: updates.showPageNumbers ?? existing.showPageNumbers,
      showGeneratedDate: updates.showGeneratedDate ?? existing.showGeneratedDate,
    };
  }
}

export const templateService = new TemplateService();

export type { DocumentTemplateConfig, DocumentSection, DocumentBranding, DocumentStyling };
