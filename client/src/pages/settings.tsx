import { 
  Card, 
  Label, 
  Input, 
  Button, 
  Switch, 
  Divider, 
  Badge, 
  Dropdown, 
  Option,
  Text,
  makeStyles, 
  tokens, 
  shorthands,
  Spinner,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent
} from "@fluentui/react-components";
import { 
  Settings20Regular, 
  Alert20Regular, 
  Shield20Regular, 
  Database20Regular, 
  Save20Regular, 
  Link20Regular, 
  Info20Regular, 
  PlugConnected20Regular, 
  CheckmarkCircle20Regular, 
  DismissCircle20Regular, 
  PaintBrush20Regular,
  DocumentText20Regular,
  Star20Regular,
  Star20Filled,
  Add20Regular,
  Copy20Regular,
  Delete20Regular,
  Edit20Regular
} from "@fluentui/react-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTheme } from "@/hooks/use-theme";
import { useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { useToastController } from "@fluentui/react-components";
import { APP_TOASTER_ID } from "@/App";

interface UserPermissions {
  canView: boolean;
  canViewAll: boolean;
  canApprove: boolean;
  canManageUsers: boolean;
  canConfigureIntegrations: boolean;
  clearanceLevel: string;
  role: string;
  azureAdGroupsActive: boolean;
}

interface UserInfo {
  user: {
    id: number;
    email: string;
    displayName: string;
    role: string;
    clearanceLevel: string;
    department: string | null;
    organizationalUnit: string | null;
  };
  permissions: UserPermissions;
}

interface AppSettings {
  id: string;
  requireApprovalForMinutes: boolean;
  enableEmailDistribution: boolean;
  emailRecipientMode: 'attendees_only' | 'all_invitees';
  enableSharePointArchival: boolean;
  enableTeamsCardNotifications: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

interface DocumentTemplateConfig {
  sections: Array<{ id: string; name: string; enabled: boolean; order: number }>;
  branding: { organizationName: string; logoEnabled: boolean; logoUrl?: string; primaryColor: string; secondaryColor: string };
  styling: { fontFamily: string; titleSize: number; headingSize: number; bodySize: number; lineSpacing: number };
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  showGeneratedDate: boolean;
}

interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isSystem: boolean;
  config: DocumentTemplateConfig;
  createdAt: string;
  updatedAt: string;
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXL),
  },
  header: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  pageTitle: {
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightHero800,
  },
  pageSubtitle: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
  },
  gridLayout: {
    display: "grid",
    gridTemplateColumns: "1fr",
    ...shorthands.gap(tokens.spacingVerticalXXL),
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "1fr 1fr",
    },
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalL,
  },
  iconContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorBrandBackground2,
  },
  iconContainerIcon: {
    color: tokens.colorBrandForeground1,
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
  },
  cardTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase400,
  },
  cardDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
  },
  cardContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },
  formField: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  fieldLabel: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  fieldDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
  },
  switchRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(tokens.strokeWidthThin, "solid", tokens.colorNeutralStroke1),
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
  },
  switchLabelContainer: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
  },
  switchLabel: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  switchDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  readOnlyNotice: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    marginBottom: tokens.spacingVerticalM,
  },
  infoBox: {
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(tokens.strokeWidthThin, "solid", tokens.colorNeutralStroke1),
    ...shorthands.padding(tokens.spacingVerticalL),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  infoBoxContent: {
    display: "flex",
    alignItems: "flex-start",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  infoBoxIcon: {
    color: tokens.colorNeutralForeground2,
    flexShrink: 0,
    marginTop: "2px",
  },
  infoBoxText: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
    fontSize: tokens.fontSizeBase200,
  },
  infoBoxTitle: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  infoBoxDescription: {
    color: tokens.colorNeutralForeground2,
  },
  infoBoxList: {
    color: tokens.colorNeutralForeground2,
    marginLeft: tokens.spacingHorizontalS,
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
  },
  buttonRow: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  fullWidthButton: {
    width: "100%",
  },
  inputGroup: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  monoInput: {
    flex: 1,
    "& input": {
      fontFamily: tokens.fontFamilyMonospace,
      fontSize: tokens.fontSizeBase200,
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  link: {
    display: "inline-flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalXXS),
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground1,
    textDecoration: "none",
    ":hover": {
      textDecoration: "underline",
    },
  },
  linkIcon: {
    fontSize: "12px",
  },
  permissionBox: {
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(tokens.strokeWidthThin, "solid", tokens.colorNeutralStroke1),
    ...shorthands.padding(tokens.spacingVerticalL),
    backgroundColor: tokens.colorNeutralBackground2,
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
  },
  permissionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  permissionLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  permissionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  permissionItem: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    fontSize: tokens.fontSizeBase200,
  },
  permissionIconActive: {
    color: tokens.colorPaletteGreenForeground1,
  },
  permissionIconInactive: {
    color: tokens.colorNeutralForeground2,
  },
  permissionTextActive: {
    color: tokens.colorNeutralForeground1,
  },
  permissionTextInactive: {
    color: tokens.colorNeutralForeground2,
  },
  statusBoxGreen: {
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(tokens.strokeWidthThin, "solid", tokens.colorPaletteGreenBorder1),
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  statusBoxYellow: {
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(tokens.strokeWidthThin, "solid", tokens.colorPaletteYellowBorder1),
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorPaletteYellowBackground1,
  },
  statusBoxContent: {
    display: "flex",
    alignItems: "flex-start",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  statusBoxIcon: {
    flexShrink: 0,
    marginTop: "2px",
  },
  statusBoxIconGreen: {
    color: tokens.colorPaletteGreenForeground1,
  },
  statusBoxIconYellow: {
    color: tokens.colorPaletteYellowForeground1,
  },
  statusBoxText: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
    fontSize: tokens.fontSizeBase200,
  },
  statusBoxTitleGreen: {
    color: tokens.colorPaletteGreenForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  statusBoxTitleYellow: {
    color: tokens.colorPaletteYellowForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  statusBoxDescGreen: {
    color: tokens.colorPaletteGreenForeground2,
    fontSize: tokens.fontSizeBase100,
  },
  statusBoxDescYellow: {
    color: tokens.colorPaletteYellowForeground2,
    fontSize: tokens.fontSizeBase100,
  },
  templateList: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  templateItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(tokens.strokeWidthThin, "solid", tokens.colorNeutralStroke1),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground1,
    transition: "background-color 0.1s",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  templateItemDefault: {
    ...shorthands.border(tokens.strokeWidthThin, "solid", tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
  },
  templateInfo: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
    flex: 1,
  },
  templateName: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  templateDesc: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  templateActions: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalXS),
  },
  defaultStar: {
    color: tokens.colorBrandForeground1,
  },
  sectionsList: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalXS),
    marginTop: tokens.spacingVerticalXS,
  },
  sectionBadge: {
    fontSize: tokens.fontSizeBase100,
  },
});

export default function Settings() {
  const styles = useStyles();
  const { uiStyle, setUIStyle } = useTheme();
  const { dispatchToast } = useToastController(APP_TOASTER_ID);
  
  const [autoArchive, setAutoArchive] = useState(true);
  const [completionAlerts, setCompletionAlerts] = useState(true);
  const [failureAlerts, setFailureAlerts] = useState(true);
  const [dailyReports, setDailyReports] = useState(false);
  const [autoProcessing, setAutoProcessing] = useState(true);
  const [extractActions, setExtractActions] = useState(true);
  const [classificationLevel, setClassificationLevel] = useState("UNCLASSIFIED");
  
  // Template editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateSections, setTemplateSections] = useState<Array<{ id: string; name: string; enabled: boolean; order: number }>>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0078D4");
  const [secondaryColor, setSecondaryColor] = useState("#106EBE");
  const [fontFamily, setFontFamily] = useState("helvetica");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [showGeneratedDate, setShowGeneratedDate] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<DocumentTemplate | null>(null);
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  const { data: userInfo, isLoading: isLoadingUser } = useQuery<UserInfo>({
    queryKey: ["/api/user/me"],
  });

  // Fetch application settings (all users can view, only admin can edit)
  const { data: appSettings, isLoading: isLoadingSettings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });
  
  const isAdmin = userInfo?.user.role === "admin";

  // Fetch document templates
  const { data: documentTemplates, isLoading: isLoadingTemplates } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });

  // Mutation for setting default template
  const setDefaultTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/document-templates/${templateId}/set-default`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to set default template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      dispatchToast(
        <div>
          <strong>Default template updated</strong>
          <div>The selected template is now the default for document exports</div>
        </div>,
        { intent: "success" }
      );
    },
    onError: (error: any) => {
      dispatchToast(
        <div>
          <strong>Update failed</strong>
          <div>{error.message || "Failed to set default template"}</div>
        </div>,
        { intent: "error" }
      );
    },
  });

  // Mutation for updating settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<AppSettings>) => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      dispatchToast(
        <div>
          <strong>Settings updated</strong>
          <div>Application settings have been saved successfully</div>
        </div>,
        { intent: "success" }
      );
    },
    onError: (error: any) => {
      dispatchToast(
        <div>
          <strong>Update failed</strong>
          <div>{error.message || "Failed to update settings"}</div>
        </div>,
        { intent: "error" }
      );
    },
  });

  // Template CRUD mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; config: DocumentTemplateConfig }) => {
      const response = await fetch("/api/document-templates", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to create template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setIsEditorOpen(false);
      dispatchToast(<div><strong>Template created</strong><div>New document template has been saved</div></div>, { intent: "success" });
    },
    onError: (error: any) => {
      dispatchToast(<div><strong>Create failed</strong><div>{error.message}</div></div>, { intent: "error" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; config?: Partial<DocumentTemplateConfig> } }) => {
      const response = await fetch(`/api/document-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to update template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setIsEditorOpen(false);
      dispatchToast(<div><strong>Template updated</strong><div>Changes have been saved</div></div>, { intent: "success" });
    },
    onError: (error: any) => {
      dispatchToast(<div><strong>Update failed</strong><div>{error.message}</div></div>, { intent: "error" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/document-templates/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
      dispatchToast(<div><strong>Template deleted</strong></div>, { intent: "success" });
    },
    onError: (error: any) => {
      dispatchToast(<div><strong>Delete failed</strong><div>{error.message}</div></div>, { intent: "error" });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await fetch(`/api/document-templates/${id}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to duplicate template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      dispatchToast(<div><strong>Template duplicated</strong></div>, { intent: "success" });
    },
    onError: (error: any) => {
      dispatchToast(<div><strong>Duplicate failed</strong><div>{error.message}</div></div>, { intent: "error" });
    },
  });

  // Default sections for new templates
  const defaultSections = [
    { id: 'title', name: 'Title Page', enabled: true, order: 1 },
    { id: 'details', name: 'Meeting Details', enabled: true, order: 2 },
    { id: 'attendees', name: 'Attendees', enabled: true, order: 3 },
    { id: 'summary', name: 'Executive Summary', enabled: true, order: 4 },
    { id: 'discussions', name: 'Key Discussions', enabled: true, order: 5 },
    { id: 'decisions', name: 'Decisions', enabled: true, order: 6 },
    { id: 'actionItems', name: 'Action Items', enabled: true, order: 7 },
  ];

  const openNewTemplateEditor = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateSections([...defaultSections]);
    setOrganizationName("");
    setPrimaryColor("#0078D4");
    setSecondaryColor("#106EBE");
    setFontFamily("helvetica");
    setHeaderText("");
    setFooterText("");
    setShowPageNumbers(true);
    setShowGeneratedDate(true);
    setLogoEnabled(false);
    setLogoUrl("");
    setIsEditorOpen(true);
  };

  const openEditTemplateEditor = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
    setTemplateSections([...template.config.sections]);
    setOrganizationName(template.config.branding.organizationName);
    setPrimaryColor(template.config.branding.primaryColor);
    setSecondaryColor(template.config.branding.secondaryColor);
    setFontFamily(template.config.styling.fontFamily);
    setHeaderText(template.config.headerText);
    setFooterText(template.config.footerText);
    setShowPageNumbers(template.config.showPageNumbers);
    setShowGeneratedDate(template.config.showGeneratedDate);
    setLogoEnabled(template.config.branding.logoEnabled || false);
    setLogoUrl(template.config.branding.logoUrl || "");
    setIsEditorOpen(true);
  };

  const handleSaveTemplate = () => {
    const config: DocumentTemplateConfig = {
      sections: templateSections,
      branding: {
        organizationName,
        logoEnabled,
        logoUrl: logoEnabled ? logoUrl : undefined,
        primaryColor,
        secondaryColor,
      },
      styling: {
        fontFamily: fontFamily as "helvetica" | "times" | "courier",
        titleSize: 18,
        headingSize: 14,
        bodySize: 11,
        lineSpacing: 1.15,
      },
      headerText,
      footerText,
      showPageNumbers,
      showGeneratedDate,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        data: { name: templateName, description: templateDescription, config },
      });
    } else {
      createTemplateMutation.mutate({ name: templateName, description: templateDescription, config });
    }
  };

  const toggleSectionEnabled = (sectionId: string) => {
    setTemplateSections(sections =>
      sections.map(s => s.id === sectionId ? { ...s, enabled: !s.enabled } : s)
    );
  };

  const moveSectionUp = (index: number) => {
    if (index === 0) return;
    const newSections = [...templateSections];
    [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    newSections.forEach((s, i) => s.order = i + 1);
    setTemplateSections(newSections);
  };

  const moveSectionDown = (index: number) => {
    if (index === templateSections.length - 1) return;
    const newSections = [...templateSections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    newSections.forEach((s, i) => s.order = i + 1);
    setTemplateSections(newSections);
  };

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      dispatchToast(
        <div><strong>Invalid file type</strong><div>Please upload a PNG, JPG, GIF, or SVG image</div></div>,
        { intent: "error" }
      );
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      dispatchToast(
        <div><strong>File too large</strong><div>Logo must be under 2MB</div></div>,
        { intent: "error" }
      );
      return;
    }
    
    setIsUploadingLogo(true);
    try {
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      
      if (!urlResponse.ok) throw new Error("Failed to get upload URL");
      
      const { uploadURL, objectPath } = await urlResponse.json();
      
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      
      if (!uploadResponse.ok) throw new Error("Failed to upload logo");
      
      setLogoUrl(objectPath);
      setLogoEnabled(true);
      dispatchToast(
        <div><strong>Logo uploaded</strong><div>Your logo has been uploaded successfully</div></div>,
        { intent: "success" }
      );
    } catch (error) {
      console.error("Logo upload error:", error);
      dispatchToast(
        <div><strong>Upload failed</strong><div>Could not upload logo. Please try again.</div></div>,
        { intent: "error" }
      );
    } finally {
      setIsUploadingLogo(false);
    }
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text className={styles.pageTitle} data-testid="heading-settings">
          Integration Settings
        </Text>
        <Text className={styles.pageSubtitle}>
          Configure Microsoft Teams, SharePoint, and Azure OpenAI integrations
        </Text>
      </div>

      <Card>
        <div className={styles.cardHeader}>
          <div className={styles.iconContainer}>
            <PaintBrush20Regular className={styles.iconContainerIcon} />
          </div>
          <div className={styles.headerText}>
            <Text className={styles.cardTitle}>UI Appearance</Text>
            <Text className={styles.cardDescription}>Choose your preferred interface design</Text>
          </div>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.formField}>
            <Label htmlFor="ui-style" className={styles.fieldLabel}>Interface Style</Label>
            <Dropdown
              id="ui-style"
              value={uiStyle === "teams" ? "Microsoft Teams (Fluent Design)" : "IBM Carbon Design"}
              selectedOptions={[uiStyle]}
              onOptionSelect={(e, data) => setUIStyle(data.optionValue as "teams" | "ibm")}
              data-testid="select-ui-style"
            >
              <Option value="teams">Microsoft Teams (Fluent Design)</Option>
              <Option value="ibm">IBM Carbon Design</Option>
            </Dropdown>
            <Text className={styles.fieldDescription}>
              {uiStyle === "teams" 
                ? "Fluent design with soft colors and rounded corners" 
                : "Data-dense Carbon design with sharp edges and monochromatic colors"}
            </Text>
          </div>
        </div>
      </Card>

      <div className={styles.gridLayout}>
        <Card>
          <div className={styles.cardHeader}>
            <div className={styles.iconContainer}>
              <PlugConnected20Regular className={styles.iconContainerIcon} />
            </div>
            <div className={styles.headerText}>
              <Text className={styles.cardTitle}>Microsoft Teams Integration</Text>
              <Text className={styles.cardDescription}>Automatically capture meetings from Microsoft Teams</Text>
            </div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.infoBox}>
              <div className={styles.infoBoxContent}>
                <Info20Regular className={styles.infoBoxIcon} />
                <div className={styles.infoBoxText}>
                  <Text className={styles.infoBoxTitle}>How it works</Text>
                  <Text className={styles.infoBoxDescription}>
                    Meetings are <strong>scheduled and conducted in Microsoft Teams</strong>. This application automatically captures completed meetings via Microsoft Graph API webhooks to process recordings and transcripts.
                  </Text>
                  <ol className={styles.infoBoxList}>
                    <li>Users schedule meetings in Microsoft Teams (not in this app)</li>
                    <li>When meetings end, Teams webhooks notify this application</li>
                    <li>App downloads recordings/transcripts via Microsoft Graph API</li>
                    <li>AI generates meeting minutes automatically</li>
                    <li>Approved minutes are distributed via email and archived to SharePoint</li>
                  </ol>
                </div>
              </div>
            </div>

            <Divider />

            <div className={styles.formField}>
              <Label htmlFor="tenant-id" className={styles.fieldLabel}>Microsoft Tenant ID</Label>
              <Input
                id="tenant-id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                data-testid="input-tenant-id"
              />
            </div>

            <div className={styles.formField}>
              <Label htmlFor="client-id" className={styles.fieldLabel}>Application (Client) ID</Label>
              <Input
                id="client-id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                data-testid="input-client-id"
              />
            </div>

            <div className={styles.formField}>
              <Label htmlFor="client-secret" className={styles.fieldLabel}>Client Secret</Label>
              <Input
                id="client-secret"
                type="password"
                placeholder="Enter client secret"
                data-testid="input-client-secret"
              />
            </div>

            <Divider />

            <div className={styles.formField}>
              <Label className={styles.fieldLabel}>Webhook Endpoint URL</Label>
              <div className={styles.inputGroup}>
                <div className={styles.monoInput}>
                  <Input
                    value="/webhooks/graph/callRecords"
                    readOnly
                    data-testid="input-webhook-url"
                  />
                </div>
                <Button size="small" appearance="outline">Copy</Button>
              </div>
              <Text className={styles.fieldDescription}>
                Configure this endpoint in Microsoft Graph API to receive meeting notifications
              </Text>
            </div>

            <div className={styles.buttonRow}>
              <Button appearance="primary" data-testid="button-test-teams-connection">
                Test Connection
              </Button>
              <Button appearance="outline" icon={<Save20Regular />} data-testid="button-save-teams-config">
                Save Configuration
              </Button>
            </div>

            <a
              href="https://learn.microsoft.com/en-us/graph/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Microsoft Graph Webhooks Documentation
              <Link20Regular className={styles.linkIcon} />
            </a>
          </div>
        </Card>

        <Card>
          <div className={styles.cardHeader}>
            <div className={styles.iconContainer}>
              <Database20Regular className={styles.iconContainerIcon} />
            </div>
            <div className={styles.headerText}>
              <Text className={styles.cardTitle}>SharePoint Configuration</Text>
              <Text className={styles.cardDescription}>Set up document archival location</Text>
            </div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.formField}>
              <Label htmlFor="sharepoint-site" className={styles.fieldLabel}>SharePoint Site URL</Label>
              <Input
                id="sharepoint-site"
                placeholder="https://yourorg.sharepoint.com/sites/meetings"
                data-testid="input-sharepoint-site"
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor="document-library" className={styles.fieldLabel}>Document Library</Label>
              <Input
                id="document-library"
                placeholder="Meeting Minutes"
                defaultValue="Meeting Minutes"
                data-testid="input-document-library"
              />
            </div>
            <div className={styles.switchRow}>
              <div className={styles.switchLabelContainer}>
                <Text className={styles.switchLabel}>Auto-Archive Completed Minutes</Text>
                <Text className={styles.switchDescription}>
                  Automatically upload to SharePoint when processing completes
                </Text>
              </div>
              <Switch
                checked={autoArchive}
                onChange={(ev, data) => setAutoArchive(data.checked)}
                data-testid="switch-auto-archive"
              />
            </div>
            <Button 
              appearance="primary" 
              icon={<Save20Regular />} 
              className={styles.fullWidthButton}
              data-testid="button-save-sharepoint-config"
            >
              Save SharePoint Configuration
            </Button>
          </div>
        </Card>

        <Card>
          <div className={styles.cardHeader}>
            <div className={styles.iconContainer}>
              <Alert20Regular className={styles.iconContainerIcon} />
            </div>
            <div className={styles.headerText}>
              <Text className={styles.cardTitle}>Notifications</Text>
              <Text className={styles.cardDescription}>Manage notification preferences</Text>
            </div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.switchRow}>
              <div className={styles.switchLabelContainer}>
                <Text className={styles.switchLabel}>Meeting Completion Alerts</Text>
                <Text className={styles.switchDescription}>
                  Get notified when minutes are generated
                </Text>
              </div>
              <Switch
                checked={completionAlerts}
                onChange={(ev, data) => setCompletionAlerts(data.checked)}
                data-testid="switch-completion-alerts"
              />
            </div>
            <div className={styles.switchRow}>
              <div className={styles.switchLabelContainer}>
                <Text className={styles.switchLabel}>Processing Failure Alerts</Text>
                <Text className={styles.switchDescription}>
                  Get notified when processing fails
                </Text>
              </div>
              <Switch
                checked={failureAlerts}
                onChange={(ev, data) => setFailureAlerts(data.checked)}
                data-testid="switch-failure-alerts"
              />
            </div>
            <div className={styles.switchRow}>
              <div className={styles.switchLabelContainer}>
                <Text className={styles.switchLabel}>Daily Summary Reports</Text>
                <Text className={styles.switchDescription}>
                  Receive daily summary of all meetings
                </Text>
              </div>
              <Switch
                checked={dailyReports}
                onChange={(ev, data) => setDailyReports(data.checked)}
                data-testid="switch-daily-reports"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className={styles.cardHeader}>
            <div className={styles.iconContainer}>
              <Settings20Regular className={styles.iconContainerIcon} />
            </div>
            <div className={styles.headerText}>
              <Text className={styles.cardTitle}>AI Processing</Text>
              <Text className={styles.cardDescription}>Configure AI-powered minute generation</Text>
            </div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.switchRow}>
              <div className={styles.switchLabelContainer}>
                <Text className={styles.switchLabel}>Automatic Processing</Text>
                <Text className={styles.switchDescription}>
                  Process transcripts automatically when available
                </Text>
              </div>
              <Switch
                checked={autoProcessing}
                onChange={(ev, data) => setAutoProcessing(data.checked)}
                data-testid="switch-auto-processing"
              />
            </div>
            <div className={styles.switchRow}>
              <div className={styles.switchLabelContainer}>
                <Text className={styles.switchLabel}>Extract Action Items</Text>
                <Text className={styles.switchDescription}>
                  Automatically identify and extract action items
                </Text>
              </div>
              <Switch
                checked={extractActions}
                onChange={(ev, data) => setExtractActions(data.checked)}
                data-testid="switch-extract-actions"
              />
            </div>
            <div className={styles.formField}>
              <Label htmlFor="classification-default" className={styles.fieldLabel}>Default Classification Level</Label>
              <Dropdown
                id="classification-default"
                value={classificationLevel === "UNCLASSIFIED" ? "Unclassified" : classificationLevel === "CONFIDENTIAL" ? "Confidential" : "Secret"}
                selectedOptions={[classificationLevel]}
                onOptionSelect={(e, data) => setClassificationLevel(data.optionValue as string)}
                data-testid="select-default-classification"
              >
                <Option value="UNCLASSIFIED">Unclassified</Option>
                <Option value="CONFIDENTIAL">Confidential</Option>
                <Option value="SECRET">Secret</Option>
              </Dropdown>
            </div>
          </div>
        </Card>

        <Card>
          <div className={styles.cardHeader}>
            <div className={styles.iconContainer}>
              <Settings20Regular className={styles.iconContainerIcon} />
            </div>
            <div className={styles.headerText}>
              <Text className={styles.cardTitle}>Workflow Settings</Text>
              <Text className={styles.cardDescription}>
                {isAdmin ? "Configure approval and distribution workflows" : "View approval and distribution workflow settings (admin only to edit)"}
              </Text>
            </div>
          </div>
          <div className={styles.cardContent}>
            {isLoadingSettings ? (
              <Text className={styles.fieldDescription}>Loading settings...</Text>
            ) : appSettings ? (
              <>
                {!isAdmin && (
                  <div className={styles.readOnlyNotice}>
                    <Info20Regular />
                    <Text>Only administrators can modify these settings.</Text>
                  </div>
                )}
                <div className={styles.switchRow}>
                  <div className={styles.switchLabelContainer}>
                    <Text className={styles.switchLabel}>Require Approval for Minutes</Text>
                    <Text className={styles.switchDescription}>
                      When enabled, minutes must be manually approved before distribution. When disabled, minutes are automatically approved and distributed after AI generation.
                    </Text>
                  </div>
                  <Switch
                    checked={appSettings.requireApprovalForMinutes}
                    onChange={(ev, data) => {
                      updateSettingsMutation.mutate({ requireApprovalForMinutes: data.checked });
                    }}
                    disabled={!isAdmin || updateSettingsMutation.isPending}
                    data-testid="switch-require-approval"
                  />
                </div>

                <Divider />

                <div className={styles.switchRow}>
                  <div className={styles.switchLabelContainer}>
                    <Text className={styles.switchLabel}>Email Distribution</Text>
                    <Text className={styles.switchDescription}>
                      Automatically send meeting minutes via email to attendees
                    </Text>
                  </div>
                  <Switch
                    checked={appSettings.enableEmailDistribution}
                    onChange={(ev, data) => {
                      updateSettingsMutation.mutate({ enableEmailDistribution: data.checked });
                    }}
                    disabled={!isAdmin || updateSettingsMutation.isPending}
                    data-testid="switch-email-distribution"
                  />
                </div>

                {appSettings.enableEmailDistribution && (
                  <div className={styles.switchRow}>
                    <div className={styles.switchLabelContainer}>
                      <Text className={styles.switchLabel}>Email Recipients</Text>
                      <Text className={styles.switchDescription}>
                        Choose who receives meeting minutes emails
                      </Text>
                    </div>
                    <Dropdown
                      value={appSettings.emailRecipientMode === 'all_invitees' ? 'All Invitees' : 'Attendees Only'}
                      selectedOptions={[appSettings.emailRecipientMode || 'attendees_only']}
                      onOptionSelect={(ev, data) => {
                        updateSettingsMutation.mutate({ emailRecipientMode: data.optionValue as 'attendees_only' | 'all_invitees' });
                      }}
                      disabled={!isAdmin || updateSettingsMutation.isPending}
                      data-testid="dropdown-email-recipients"
                    >
                      <Option value="attendees_only">Attendees Only (joined the call)</Option>
                      <Option value="all_invitees">All Invitees (everyone invited)</Option>
                    </Dropdown>
                  </div>
                )}

                <div className={styles.switchRow}>
                  <div className={styles.switchLabelContainer}>
                    <Text className={styles.switchLabel}>SharePoint Archival</Text>
                    <Text className={styles.switchDescription}>
                      Automatically upload approved minutes to SharePoint
                    </Text>
                  </div>
                  <Switch
                    checked={appSettings.enableSharePointArchival}
                    onChange={(ev, data) => {
                      updateSettingsMutation.mutate({ enableSharePointArchival: data.checked });
                    }}
                    disabled={!isAdmin || updateSettingsMutation.isPending}
                    data-testid="switch-sharepoint-archival"
                  />
                </div>

                <div className={styles.switchRow}>
                  <div className={styles.switchLabelContainer}>
                    <Text className={styles.switchLabel}>Teams Card Notifications</Text>
                    <Text className={styles.switchDescription}>
                      Post Adaptive Cards to Teams meeting chats with minutes summary
                    </Text>
                  </div>
                  <Switch
                    checked={appSettings.enableTeamsCardNotifications}
                    onChange={(ev, data) => {
                      updateSettingsMutation.mutate({ enableTeamsCardNotifications: data.checked });
                    }}
                    disabled={!isAdmin || updateSettingsMutation.isPending}
                    data-testid="switch-teams-notifications"
                  />
                </div>

                <Divider />

                <div className={styles.infoBox}>
                  <div className={styles.infoBoxContent}>
                    <Info20Regular className={styles.infoBoxIcon} />
                    <div className={styles.infoBoxText}>
                      <Text className={styles.infoBoxTitle}>
                        {appSettings.requireApprovalForMinutes ? "Manual Approval Workflow" : "Fully Autonomous Workflow"}
                      </Text>
                      <Text className={styles.infoBoxDescription}>
                        {appSettings.requireApprovalForMinutes ? (
                          <>
                            <strong>Current Mode:</strong> Minutes require manual approval before distribution
                            <br /><br />
                            <strong>Flow:</strong> Meeting ends → AI generates minutes → Status: "Pending Review" → Approver clicks "Approve" → Email + SharePoint + Teams card sent automatically
                          </>
                        ) : (
                          <>
                            <strong>Current Mode:</strong> Fully autonomous - minutes automatically approved and distributed
                            <br /><br />
                            <strong>Flow:</strong> Meeting ends → AI generates minutes → Status: "Approved" (automatic) → Email + SharePoint + Teams card sent automatically
                          </>
                        )}
                      </Text>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Text className={styles.fieldDescription}>Failed to load settings</Text>
            )}
          </div>
        </Card>

        <Card>
          <div className={styles.cardHeader}>
            <div className={styles.iconContainer}>
              <DocumentText20Regular className={styles.iconContainerIcon} />
            </div>
            <div className={styles.headerText}>
              <Text className={styles.cardTitle}>Document Templates</Text>
              <Text className={styles.cardDescription}>Customize how meeting minutes are formatted in DOCX and PDF exports</Text>
            </div>
          </div>
          <div className={styles.cardContent}>
            {isLoadingTemplates ? (
              <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                <Spinner size="tiny" />
                <Text className={styles.fieldDescription}>Loading templates...</Text>
              </div>
            ) : documentTemplates && documentTemplates.length > 0 ? (
              <>
                <div className={styles.templateList}>
                  {documentTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={`${styles.templateItem} ${template.isDefault ? styles.templateItemDefault : ""}`}
                      data-testid={`template-item-${template.id}`}
                    >
                      <div className={styles.templateInfo}>
                        <div className={styles.templateName}>
                          {template.isDefault && (
                            <Star20Filled className={styles.defaultStar} />
                          )}
                          <span>{template.name}</span>
                          {template.isSystem && (
                            <Badge appearance="outline" size="small">System</Badge>
                          )}
                        </div>
                        {template.description && (
                          <Text className={styles.templateDesc}>{template.description}</Text>
                        )}
                        <div className={styles.sectionsList}>
                          {template.config.sections
                            .filter(s => s.enabled)
                            .sort((a, b) => a.order - b.order)
                            .map(section => (
                              <Badge
                                key={section.id}
                                appearance="outline"
                                size="small"
                                className={styles.sectionBadge}
                              >
                                {section.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                      <div className={styles.templateActions}>
                        {!template.isDefault && (
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<Star20Regular />}
                            onClick={() => setDefaultTemplateMutation.mutate(template.id)}
                            disabled={setDefaultTemplateMutation.isPending}
                            data-testid={`button-set-default-${template.id}`}
                            title="Set as default"
                          />
                        )}
                        {isAdmin && !template.isSystem && (
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<Edit20Regular />}
                            onClick={() => openEditTemplateEditor(template)}
                            data-testid={`button-edit-template-${template.id}`}
                            title="Edit template"
                          />
                        )}
                        {isAdmin && (
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<Copy20Regular />}
                            onClick={() => duplicateTemplateMutation.mutate({ id: template.id, name: `${template.name} (Copy)` })}
                            disabled={duplicateTemplateMutation.isPending}
                            data-testid={`button-duplicate-template-${template.id}`}
                            title="Duplicate template"
                          />
                        )}
                        {isAdmin && !template.isSystem && !template.isDefault && (
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<Delete20Regular />}
                            onClick={() => { setTemplateToDelete(template); setDeleteConfirmOpen(true); }}
                            data-testid={`button-delete-template-${template.id}`}
                            title="Delete template"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <Button
                    appearance="primary"
                    icon={<Add20Regular />}
                    onClick={openNewTemplateEditor}
                    data-testid="button-create-template"
                    style={{ marginTop: tokens.spacingVerticalM }}
                  >
                    Create Template
                  </Button>
                )}

                <div className={styles.infoBox} style={{ marginTop: tokens.spacingVerticalM }}>
                  <div className={styles.infoBoxContent}>
                    <Info20Regular className={styles.infoBoxIcon} />
                    <div className={styles.infoBoxText}>
                      <Text className={styles.infoBoxTitle}>How templates work</Text>
                      <Text className={styles.infoBoxDescription}>
                        The default template (marked with a star) is used when exporting meeting minutes to DOCX or PDF. 
                        Templates control which sections are included, their order, fonts, and branding.
                      </Text>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <Text className={styles.fieldDescription}>No document templates found</Text>
                {isAdmin && (
                  <Button
                    appearance="primary"
                    icon={<Add20Regular />}
                    onClick={openNewTemplateEditor}
                    data-testid="button-create-template-empty"
                    style={{ marginTop: tokens.spacingVerticalM }}
                  >
                    Create Template
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className={styles.cardHeader}>
            <div className={styles.iconContainer}>
              <Shield20Regular className={styles.iconContainerIcon} />
            </div>
            <div className={styles.headerText}>
              <Text className={styles.cardTitle}>User Permissions & Authorization</Text>
              <Text className={styles.cardDescription}>Your access level and Azure AD group status</Text>
            </div>
          </div>
          <div className={styles.cardContent}>
            {isLoadingUser ? (
              <Text className={styles.fieldDescription}>Loading permissions...</Text>
            ) : userInfo ? (
              <>
                <div className={styles.permissionBox}>
                  <div className={styles.permissionRow}>
                    <Text className={styles.permissionLabel}>Authorization Source</Text>
                    <Badge 
                      appearance={userInfo.permissions?.azureAdGroupsActive ? "filled" : "outline"}
                      icon={userInfo.permissions?.azureAdGroupsActive ? <CheckmarkCircle20Regular /> : <Info20Regular />}
                    >
                      {userInfo.permissions?.azureAdGroupsActive ? "Azure AD Groups" : "Database Fallback"}
                    </Badge>
                  </div>
                  <div className={styles.permissionRow}>
                    <Text className={styles.permissionLabel}>Effective Role</Text>
                    <Badge appearance="outline">{userInfo.permissions?.role}</Badge>
                  </div>
                  <div className={styles.permissionRow}>
                    <Text className={styles.permissionLabel}>Clearance Level</Text>
                    <Badge appearance="outline">{userInfo.permissions?.clearanceLevel}</Badge>
                  </div>
                </div>

                <Divider />

                <div className={styles.formField}>
                  <Label className={styles.fieldLabel}>Permissions</Label>
                  <div className={styles.permissionGrid}>
                    <div className={styles.permissionItem}>
                      {userInfo.permissions?.canViewAll ? (
                        <CheckmarkCircle20Regular className={styles.permissionIconActive} />
                      ) : (
                        <DismissCircle20Regular className={styles.permissionIconInactive} />
                      )}
                      <Text className={userInfo.permissions?.canViewAll ? styles.permissionTextActive : styles.permissionTextInactive}>
                        View All Meetings (Admin/Auditor)
                      </Text>
                    </div>
                    <div className={styles.permissionItem}>
                      {userInfo.permissions?.canApprove ? (
                        <CheckmarkCircle20Regular className={styles.permissionIconActive} />
                      ) : (
                        <DismissCircle20Regular className={styles.permissionIconInactive} />
                      )}
                      <Text className={userInfo.permissions?.canApprove ? styles.permissionTextActive : styles.permissionTextInactive}>
                        Approve Meeting Minutes
                      </Text>
                    </div>
                    <div className={styles.permissionItem}>
                      {userInfo.permissions?.canManageUsers ? (
                        <CheckmarkCircle20Regular className={styles.permissionIconActive} />
                      ) : (
                        <DismissCircle20Regular className={styles.permissionIconInactive} />
                      )}
                      <Text className={userInfo.permissions?.canManageUsers ? styles.permissionTextActive : styles.permissionTextInactive}>
                        Manage Users (Admin Only)
                      </Text>
                    </div>
                    <div className={styles.permissionItem}>
                      {userInfo.permissions?.canConfigureIntegrations ? (
                        <CheckmarkCircle20Regular className={styles.permissionIconActive} />
                      ) : (
                        <DismissCircle20Regular className={styles.permissionIconInactive} />
                      )}
                      <Text className={userInfo.permissions?.canConfigureIntegrations ? styles.permissionTextActive : styles.permissionTextInactive}>
                        Configure Integrations (Admin Only)
                      </Text>
                    </div>
                  </div>
                </div>

                {userInfo.permissions?.azureAdGroupsActive && (
                  <div className={styles.statusBoxGreen}>
                    <div className={styles.statusBoxContent}>
                      <CheckmarkCircle20Regular className={`${styles.statusBoxIcon} ${styles.statusBoxIconGreen}`} />
                      <div className={styles.statusBoxText}>
                        <Text className={styles.statusBoxTitleGreen}>Azure AD Integration Active</Text>
                        <Text className={styles.statusBoxDescGreen}>
                          Permissions are managed through Azure AD security groups. Changes to your Azure AD group membership will be reflected within 15 minutes.
                        </Text>
                      </div>
                    </div>
                  </div>
                )}

                {!userInfo.permissions?.azureAdGroupsActive && (
                  <div className={styles.statusBoxYellow}>
                    <div className={styles.statusBoxContent}>
                      <Info20Regular className={`${styles.statusBoxIcon} ${styles.statusBoxIconYellow}`} />
                      <div className={styles.statusBoxText}>
                        <Text className={styles.statusBoxTitleYellow}>Database Fallback Mode</Text>
                        <Text className={styles.statusBoxDescYellow}>
                          Permissions are currently sourced from the database. Azure AD groups integration is not active or unavailable. Contact your administrator to enable Azure AD integration.
                        </Text>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Text className={styles.fieldDescription}>Failed to load permissions</Text>
            )}
          </div>
        </Card>
      </div>

      {/* Template Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={(_, data) => setIsEditorOpen(data.open)}>
        <DialogSurface style={{ maxWidth: "700px", width: "90vw" }}>
          <DialogBody>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
              <div>
                <Label htmlFor="template-name" required>Template Name</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(_, data) => setTemplateName(data.value)}
                  placeholder="Enter template name"
                  data-testid="input-template-name"
                />
              </div>
              <div>
                <Label htmlFor="template-desc">Description</Label>
                <Input
                  id="template-desc"
                  value={templateDescription}
                  onChange={(_, data) => setTemplateDescription(data.value)}
                  placeholder="Enter description (optional)"
                  data-testid="input-template-description"
                />
              </div>

              <Divider />
              <Text weight="semibold">Sections</Text>
              <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS }}>
                {templateSections.sort((a, b) => a.order - b.order).map((section, index) => (
                  <div key={section.id} style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, padding: tokens.spacingVerticalXS, backgroundColor: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusMedium }}>
                    <Switch
                      checked={section.enabled}
                      onChange={() => toggleSectionEnabled(section.id)}
                      data-testid={`switch-section-${section.id}`}
                    />
                    <Text style={{ flex: 1 }}>{section.name}</Text>
                    <Button size="small" appearance="subtle" onClick={() => moveSectionUp(index)} disabled={index === 0} title="Move up" data-testid={`button-section-up-${section.id}`}>↑</Button>
                    <Button size="small" appearance="subtle" onClick={() => moveSectionDown(index)} disabled={index === templateSections.length - 1} title="Move down" data-testid={`button-section-down-${section.id}`}>↓</Button>
                  </div>
                ))}
              </div>

              <Divider />
              <Text weight="semibold">Branding</Text>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingVerticalS }}>
                <div>
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={organizationName}
                    onChange={(_, data) => setOrganizationName(data.value)}
                    placeholder="Your organization"
                    data-testid="input-org-name"
                  />
                </div>
                <div>
                  <Label htmlFor="font-family">Font Family</Label>
                  <Dropdown
                    id="font-family"
                    value={fontFamily === "helvetica" ? "Helvetica (Sans-serif)" : fontFamily === "times" ? "Times (Serif)" : "Courier (Monospace)"}
                    selectedOptions={[fontFamily]}
                    onOptionSelect={(_, data) => setFontFamily(data.optionValue as string)}
                    data-testid="dropdown-font-family"
                  >
                    <Option value="helvetica">Helvetica (Sans-serif)</Option>
                    <Option value="times">Times (Serif)</Option>
                    <Option value="courier">Courier (Monospace)</Option>
                  </Dropdown>
                </div>
                <div>
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                    <input
                      type="color"
                      id="primary-color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      data-testid="input-primary-color"
                      style={{ width: "40px", height: "32px", border: "none", borderRadius: tokens.borderRadiusMedium, cursor: "pointer" }}
                    />
                    <Input
                      value={primaryColor}
                      onChange={(_, data) => setPrimaryColor(data.value)}
                      style={{ flex: 1 }}
                      placeholder="#0078D4"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                    <input
                      type="color"
                      id="secondary-color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      data-testid="input-secondary-color"
                      style={{ width: "40px", height: "32px", border: "none", borderRadius: tokens.borderRadiusMedium, cursor: "pointer" }}
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(_, data) => setSecondaryColor(data.value)}
                      style={{ flex: 1 }}
                      placeholder="#106EBE"
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: tokens.spacingVerticalS }}>
                <Label>Organization Logo</Label>
                <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM, marginTop: tokens.spacingVerticalXS }}>
                  <Switch
                    checked={logoEnabled}
                    onChange={(_, data) => setLogoEnabled(data.checked)}
                    data-testid="switch-logo-enabled"
                  />
                  <Text size={200}>{logoEnabled ? "Logo enabled" : "No logo"}</Text>
                </div>
                {logoEnabled && (
                  <div style={{ marginTop: tokens.spacingVerticalS, display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM }}>
                    {logoUrl ? (
                      <>
                        <div style={{ 
                          width: "80px", 
                          height: "60px", 
                          border: `1px solid ${tokens.colorNeutralStroke1}`,
                          borderRadius: tokens.borderRadiusMedium,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          backgroundColor: tokens.colorNeutralBackground2
                        }}>
                          <img 
                            src={logoUrl} 
                            alt="Logo preview" 
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS }}>
                          <Button
                            appearance="secondary"
                            size="small"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/png,image/jpeg,image/gif,image/svg+xml';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) handleLogoUpload(file);
                              };
                              input.click();
                            }}
                            disabled={isUploadingLogo}
                            data-testid="button-replace-logo"
                          >
                            {isUploadingLogo ? <Spinner size="tiny" /> : "Replace Logo"}
                          </Button>
                          <Button
                            appearance="subtle"
                            size="small"
                            onClick={() => {
                              setLogoUrl("");
                            }}
                            data-testid="button-remove-logo"
                          >
                            Remove
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button
                        appearance="secondary"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/png,image/jpeg,image/gif,image/svg+xml';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleLogoUpload(file);
                          };
                          input.click();
                        }}
                        disabled={isUploadingLogo}
                        data-testid="button-upload-logo"
                      >
                        {isUploadingLogo ? <Spinner size="tiny" /> : "Upload Logo"}
                      </Button>
                    )}
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                      PNG, JPG, GIF, or SVG (max 2MB)
                    </Text>
                  </div>
                )}
              </div>

              <Divider />
              <Text weight="semibold">Header & Footer</Text>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingVerticalS }}>
                <div>
                  <Label htmlFor="header-text">Header Text</Label>
                  <Input
                    id="header-text"
                    value={headerText}
                    onChange={(_, data) => setHeaderText(data.value)}
                    placeholder="Text in document header"
                    data-testid="input-header-text"
                  />
                </div>
                <div>
                  <Label htmlFor="footer-text">Footer Text</Label>
                  <Input
                    id="footer-text"
                    value={footerText}
                    onChange={(_, data) => setFooterText(data.value)}
                    placeholder="Text in document footer"
                    data-testid="input-footer-text"
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: tokens.spacingHorizontalL }}>
                <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                  <Switch
                    checked={showPageNumbers}
                    onChange={(_, data) => setShowPageNumbers(data.checked)}
                    data-testid="switch-page-numbers"
                  />
                  <Label>Show page numbers</Label>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                  <Switch
                    checked={showGeneratedDate}
                    onChange={(_, data) => setShowGeneratedDate(data.checked)}
                    data-testid="switch-generated-date"
                  />
                  <Label>Show generated date</Label>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsEditorOpen(false)} data-testid="button-cancel-template">Cancel</Button>
              <Button
                appearance="primary"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || createTemplateMutation.isPending || updateTemplateMutation.isPending}
                data-testid="button-save-template"
              >
                {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? <Spinner size="tiny" /> : (editingTemplate ? "Save Changes" : "Create Template")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(_, data) => setDeleteConfirmOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogContent>
              <Text>Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.</Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteConfirmOpen(false)} data-testid="button-cancel-delete">Cancel</Button>
              <Button
                appearance="primary"
                onClick={() => templateToDelete && deleteTemplateMutation.mutate(templateToDelete.id)}
                disabled={deleteTemplateMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteTemplateMutation.isPending ? <Spinner size="tiny" /> : "Delete"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
