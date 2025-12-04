import { useState, useMemo } from "react";
import {
  makeStyles,
  tokens,
  shorthands,
  Card,
  CardHeader,
  Text,
  Divider,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Input,
  Button,
  Textarea,
  Dropdown,
  Option,
  Spinner,
  TabList,
  Tab,
  Field,
} from "@fluentui/react-components";
import {
  Info24Regular,
  Rocket24Regular,
  DocumentBulletList24Regular,
  CheckmarkCircle24Regular,
  ArrowDownload24Regular,
  Warning24Regular,
  QuestionCircle24Regular,
  PersonFeedback24Regular,
  ShieldCheckmark24Regular,
  Calendar24Regular,
  People24Regular,
  Search24Regular,
  Send24Regular,
  Mail24Regular,
  Checkmark24Regular,
} from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const useStyles = makeStyles({
  container: {
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("24px"),
  },
  header: {
    marginBottom: "24px",
  },
  title: {
    fontSize: "28px",
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "16px",
    color: tokens.colorNeutralForeground2,
  },
  tabList: {
    marginBottom: "24px",
  },
  searchContainer: {
    marginBottom: "24px",
  },
  searchInput: {
    width: "100%",
    maxWidth: "500px",
  },
  searchResults: {
    marginTop: "16px",
    ...shorthands.padding("16px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
  },
  searchResultItem: {
    ...shorthands.padding("12px"),
    marginBottom: "8px",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: "pointer",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  searchResultTitle: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: "4px",
  },
  searchResultSnippet: {
    fontSize: "13px",
    color: tokens.colorNeutralForeground2,
  },
  noResults: {
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  section: {
    marginBottom: "32px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
    marginBottom: "16px",
  },
  sectionIcon: {
    color: tokens.colorBrandForeground1,
  },
  card: {
    marginBottom: "16px",
  },
  paragraph: {
    fontSize: "14px",
    lineHeight: "1.6",
    color: tokens.colorNeutralForeground1,
    marginBottom: "12px",
  },
  list: {
    marginLeft: "20px",
    marginBottom: "16px",
  },
  listItem: {
    fontSize: "14px",
    lineHeight: "1.8",
    color: tokens.colorNeutralForeground1,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    ...shorthands.gap("16px"),
    marginBottom: "24px",
  },
  featureCard: {
    ...shorthands.padding("16px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
  },
  featureTitle: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  featureDescription: {
    fontSize: "13px",
    color: tokens.colorNeutralForeground2,
  },
  warningBox: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteYellowBorder1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("16px"),
    marginBottom: "16px",
    display: "flex",
    ...shorthands.gap("12px"),
  },
  warningIcon: {
    color: tokens.colorPaletteYellowForeground1,
    flexShrink: 0,
  },
  infoBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("16px"),
    marginBottom: "16px",
  },
  tableContainer: {
    marginBottom: "16px",
    overflowX: "auto",
  },
  version: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    marginTop: "32px",
    textAlign: "center" as const,
  },
  contactForm: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
    maxWidth: "600px",
  },
  formRow: {
    display: "flex",
    ...shorthands.gap("16px"),
  },
  formField: {
    flex: 1,
  },
  submitButton: {
    alignSelf: "flex-start",
    marginTop: "8px",
  },
  successMessage: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteGreenBorder1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("16px"),
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
  },
  successIcon: {
    color: tokens.colorPaletteGreenForeground1,
  },
  highlightedText: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    ...shorthands.padding("2px", "4px"),
    ...shorthands.borderRadius("2px"),
  },
});

interface HelpArticle {
  id: string;
  title: string;
  section: string;
  content: string;
  keywords: string[];
}

const helpArticles: HelpArticle[] = [
  {
    id: "about",
    title: "About This App",
    section: "Getting Started",
    content: "Meeting Minutes is an AI-powered application that automatically captures your Microsoft Teams meetings and generates professional meeting minutes. The app integrates with Microsoft 365 to streamline documentation.",
    keywords: ["about", "what", "app", "introduction", "overview"],
  },
  {
    id: "access",
    title: "Accessing the App",
    section: "Getting Started",
    content: "Open Microsoft Teams and look for Meeting Minutes in the left sidebar. Click the app icon to open it. You'll be automatically signed in with your Microsoft 365 account.",
    keywords: ["access", "open", "start", "login", "sidebar", "teams"],
  },
  {
    id: "roles",
    title: "Understanding Your Role",
    section: "Getting Started",
    content: "Viewer can view own meetings. Approver can view and approve meetings. Auditor has read-only access to all meetings. Admin has full access including settings.",
    keywords: ["role", "permission", "access", "viewer", "approver", "auditor", "admin"],
  },
  {
    id: "dashboard",
    title: "Using the Dashboard",
    section: "Getting Started",
    content: "The Dashboard shows stats cards with meeting counts, recent meetings with status, and a search feature to find specific meetings by title.",
    keywords: ["dashboard", "home", "stats", "overview", "meetings"],
  },
  {
    id: "view-minutes",
    title: "Viewing Meeting Minutes",
    section: "Using the App",
    content: "Click on a meeting with minutes available status, navigate to the Minutes tab to see AI-generated summary, key discussions, decisions, and action items.",
    keywords: ["view", "minutes", "summary", "discussions", "decisions"],
  },
  {
    id: "action-items",
    title: "Managing Action Items",
    section: "Using the App",
    content: "Open a meeting and go to the Action Items tab. Find the item you want to update, click the Status dropdown, and select Pending, In Progress, or Completed. All changes are recorded in History.",
    keywords: ["action", "items", "tasks", "status", "pending", "progress", "completed"],
  },
  {
    id: "approve",
    title: "Approving Minutes",
    section: "Using the App",
    content: "Only Approvers and Admins can approve minutes. Open a meeting with Pending Review status, review the minutes for accuracy, then click Approve to accept or Reject with a reason.",
    keywords: ["approve", "approval", "review", "reject", "pending"],
  },
  {
    id: "export",
    title: "Downloading Documents",
    section: "Using the App",
    content: "Open a meeting with completed minutes, go to the Attachments tab, and click Download DOCX or Download PDF. DOCX is best for editing, PDF is best for distribution.",
    keywords: ["download", "export", "docx", "pdf", "document", "word"],
  },
  {
    id: "history",
    title: "Viewing Meeting History",
    section: "Using the App",
    content: "The History tab provides a complete audit trail showing when minutes were generated, approved or rejected, emails sent, SharePoint archival, and action item status changes.",
    keywords: ["history", "audit", "trail", "events", "timeline"],
  },
  {
    id: "transcription",
    title: "Transcription Required",
    section: "Limitations",
    content: "Meetings must have transcription enabled in Teams. No transcript means no minutes can be generated. Enable transcription at the start of each meeting.",
    keywords: ["transcription", "transcript", "enable", "required", "audio"],
  },
  {
    id: "processing-time",
    title: "Processing Time",
    section: "Limitations",
    content: "Minutes typically appear 5-10 minutes after meeting ends. Complex meetings may take longer. Wait for processing to complete before checking.",
    keywords: ["processing", "time", "wait", "delay", "loading"],
  },
  {
    id: "no-meeting",
    title: "Meeting Not Appearing",
    section: "Troubleshooting",
    content: "Wait 5-10 minutes after the meeting ends, refresh the dashboard, verify it was a Teams meeting (not a call), and check if you were an attendee or organizer.",
    keywords: ["missing", "not appearing", "cannot find", "where", "meeting"],
  },
  {
    id: "no-minutes",
    title: "No Minutes Generated",
    section: "Troubleshooting",
    content: "Check if transcription was enabled during the meeting, verify the meeting was longer than 5 minutes, wait for processing, or contact your administrator.",
    keywords: ["no minutes", "not generated", "empty", "missing"],
  },
  {
    id: "cant-approve",
    title: "Cannot Approve Minutes",
    section: "Troubleshooting",
    content: "Verify you have Approver or Admin role, check if minutes are in Pending Review status, they may already be approved by another user.",
    keywords: ["cannot approve", "approval", "permission", "button"],
  },
  {
    id: "login-issue",
    title: "Authentication Problems",
    section: "Troubleshooting",
    content: "Close and reopen Microsoft Teams, clear Teams cache and restart, verify your Microsoft 365 account is active, or contact IT support.",
    keywords: ["login", "authentication", "sign in", "error", "access denied"],
  },
];

export default function Help() {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<string>("guide");
  const [searchQuery, setSearchQuery] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    category: "general",
    description: "",
  });

  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return helpArticles.filter(article => 
      article.title.toLowerCase().includes(query) ||
      article.content.toLowerCase().includes(query) ||
      article.keywords.some(k => k.includes(query)) ||
      article.section.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [searchQuery]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(`help-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setSearchQuery("");
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/help/request", data);
    },
    onSuccess: () => {
      setFormSubmitted(true);
      setFormData({ subject: "", category: "general", description: "" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.subject && formData.description) {
      submitMutation.mutate(formData);
    }
  };

  return (
    <div className={styles.container} data-testid="page-help">
      <div className={styles.header}>
        <h1 className={styles.title} data-testid="heading-help">Help Center</h1>
        <Text className={styles.subtitle}>
          Find answers and get support for the Meeting Minutes application
        </Text>
      </div>

      <TabList
        className={styles.tabList}
        selectedValue={selectedTab}
        onTabSelect={(_, data) => {
          setSelectedTab(data.value as string);
          setFormSubmitted(false);
        }}
        data-testid="tabs-help"
      >
        <Tab value="guide" icon={<QuestionCircle24Regular />} data-testid="tab-guide">
          User Guide
        </Tab>
        <Tab value="contact" icon={<Mail24Regular />} data-testid="tab-contact">
          Contact Support
        </Tab>
      </TabList>

      {selectedTab === "guide" && (
        <>
          {/* Search Box */}
          <div className={styles.searchContainer}>
            <Input
              className={styles.searchInput}
              placeholder="Search help topics... (e.g., 'approve', 'action items', 'transcription')"
              value={searchQuery}
              onChange={(_, data) => setSearchQuery(data.value)}
              contentBefore={<Search24Regular />}
              data-testid="input-help-search"
            />
            
            {searchQuery.trim() && (
              <div className={styles.searchResults} data-testid="container-search-results">
                {filteredArticles.length > 0 ? (
                  <>
                    <Text weight="semibold" style={{ marginBottom: "12px", display: "block" }}>
                      Found {filteredArticles.length} result{filteredArticles.length !== 1 ? "s" : ""}
                    </Text>
                    {filteredArticles.map(article => (
                      <div
                        key={article.id}
                        className={styles.searchResultItem}
                        onClick={() => scrollToSection(article.id)}
                        data-testid={`search-result-${article.id}`}
                      >
                        <div className={styles.searchResultTitle}>
                          {article.title}
                          <Badge appearance="outline" size="small" style={{ marginLeft: "8px" }}>
                            {article.section}
                          </Badge>
                        </div>
                        <div className={styles.searchResultSnippet}>
                          {article.content.slice(0, 120)}...
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className={styles.noResults}>
                    No results found for "{searchQuery}". Try different keywords or browse the guide below.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* About the App */}
          <section className={styles.section} id="help-about">
            <h2 className={styles.sectionTitle}>
              <Info24Regular className={styles.sectionIcon} />
              About This App
            </h2>
            <Card className={styles.card}>
              <p className={styles.paragraph}>
                <strong>Meeting Minutes</strong> is an AI-powered application that automatically captures 
                your Microsoft Teams meetings and generates professional meeting minutes. The app integrates 
                seamlessly with Microsoft 365 to streamline your meeting documentation workflow.
              </p>
              <div className={styles.featureGrid}>
                <div className={styles.featureCard}>
                  <div className={styles.featureTitle}>
                    <Calendar24Regular />
                    Auto-Capture
                  </div>
                  <Text className={styles.featureDescription}>
                    Automatically detects when your Teams meetings end and captures meeting data.
                  </Text>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureTitle}>
                    <DocumentBulletList24Regular />
                    AI Minutes
                  </div>
                  <Text className={styles.featureDescription}>
                    Generates comprehensive minutes including summary, discussions, decisions, and action items.
                  </Text>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureTitle}>
                    <CheckmarkCircle24Regular />
                    Approval Workflow
                  </div>
                  <Text className={styles.featureDescription}>
                    Review and approve minutes before distribution to ensure accuracy.
                  </Text>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureTitle}>
                    <ArrowDownload24Regular />
                    Export Options
                  </div>
                  <Text className={styles.featureDescription}>
                    Download minutes as DOCX or PDF documents for sharing and archival.
                  </Text>
                </div>
              </div>
            </Card>
          </section>

          {/* Getting Started */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Rocket24Regular className={styles.sectionIcon} />
              Getting Started
            </h2>
            <Card className={styles.card}>
              <Accordion collapsible defaultOpenItems={["access"]}>
                <AccordionItem value="access" id="help-access">
                  <AccordionHeader>Accessing the App</AccordionHeader>
                  <AccordionPanel>
                    <ol className={styles.list}>
                      <li className={styles.listItem}>Open Microsoft Teams (desktop, web, or mobile)</li>
                      <li className={styles.listItem}>Look for <strong>"Meeting Minutes"</strong> in the left sidebar</li>
                      <li className={styles.listItem}>Click the app icon to open it</li>
                      <li className={styles.listItem}>You'll be automatically signed in with your Microsoft 365 account</li>
                    </ol>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="roles" id="help-roles">
                  <AccordionHeader>Understanding Your Role</AccordionHeader>
                  <AccordionPanel>
                    <p className={styles.paragraph}>Your role determines what you can do in the app:</p>
                    <div className={styles.tableContainer}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell>Role</TableHeaderCell>
                            <TableHeaderCell>View Meetings</TableHeaderCell>
                            <TableHeaderCell>Approve</TableHeaderCell>
                            <TableHeaderCell>Settings</TableHeaderCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell><Badge appearance="outline">Viewer</Badge></TableCell>
                            <TableCell>Own meetings only</TableCell>
                            <TableCell>No</TableCell>
                            <TableCell>No</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell><Badge appearance="outline" color="brand">Approver</Badge></TableCell>
                            <TableCell>Assigned meetings</TableCell>
                            <TableCell>Yes</TableCell>
                            <TableCell>No</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell><Badge appearance="outline" color="informative">Auditor</Badge></TableCell>
                            <TableCell>All (read-only)</TableCell>
                            <TableCell>No</TableCell>
                            <TableCell>No</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell><Badge appearance="outline" color="success">Admin</Badge></TableCell>
                            <TableCell>All</TableCell>
                            <TableCell>Yes</TableCell>
                            <TableCell>Yes</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="dashboard" id="help-dashboard">
                  <AccordionHeader>Using the Dashboard</AccordionHeader>
                  <AccordionPanel>
                    <p className={styles.paragraph}>The Dashboard is your home screen showing:</p>
                    <ul className={styles.list}>
                      <li className={styles.listItem}><strong>Stats Cards</strong> - Quick overview of meeting counts</li>
                      <li className={styles.listItem}><strong>Recent Meetings</strong> - Your latest meetings with status</li>
                      <li className={styles.listItem}><strong>Search</strong> - Find specific meetings by title</li>
                    </ul>
                    <p className={styles.paragraph}>
                      Click <strong>"View Details"</strong> on any meeting to see full information.
                    </p>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </Card>
          </section>

          {/* How to Use */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <DocumentBulletList24Regular className={styles.sectionIcon} />
              Using the App
            </h2>
            <Card className={styles.card}>
              <Accordion collapsible>
                <AccordionItem value="view-minutes" id="help-view-minutes">
                  <AccordionHeader>Viewing Meeting Minutes</AccordionHeader>
                  <AccordionPanel>
                    <ol className={styles.list}>
                      <li className={styles.listItem}>Click on a meeting with "Minutes available" status</li>
                      <li className={styles.listItem}>Navigate to the <strong>Minutes</strong> tab</li>
                      <li className={styles.listItem}>Review the AI-generated content:
                        <ul>
                          <li>Summary - Overview of the meeting</li>
                          <li>Key Discussions - Important topics covered</li>
                          <li>Decisions - Agreements reached</li>
                          <li>Action Items - Tasks with assignees and due dates</li>
                        </ul>
                      </li>
                    </ol>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="action-items" id="help-action-items">
                  <AccordionHeader>Managing Action Items</AccordionHeader>
                  <AccordionPanel>
                    <p className={styles.paragraph}>Track progress on tasks extracted from meetings:</p>
                    <ol className={styles.list}>
                      <li className={styles.listItem}>Open a meeting and go to the <strong>Action Items</strong> tab</li>
                      <li className={styles.listItem}>Find the action item you want to update</li>
                      <li className={styles.listItem}>Click the <strong>Status</strong> dropdown</li>
                      <li className={styles.listItem}>Select: Pending, In Progress, or Completed</li>
                    </ol>
                    <p className={styles.paragraph}>
                      All status changes are recorded in the History tab for audit purposes.
                    </p>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="approve" id="help-approve">
                  <AccordionHeader>Approving Minutes</AccordionHeader>
                  <AccordionPanel>
                    <p className={styles.paragraph}>
                      <em>Note: Only Approvers and Admins can approve minutes.</em>
                    </p>
                    <ol className={styles.list}>
                      <li className={styles.listItem}>Open a meeting with "Pending Review" status</li>
                      <li className={styles.listItem}>Review the minutes for accuracy</li>
                      <li className={styles.listItem}>Click <strong>Approve</strong> to accept, or <strong>Reject</strong> with a reason</li>
                    </ol>
                    <p className={styles.paragraph}>
                      After approval, minutes can be distributed via email and archived to SharePoint.
                    </p>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="export" id="help-export">
                  <AccordionHeader>Downloading Documents</AccordionHeader>
                  <AccordionPanel>
                    <ol className={styles.list}>
                      <li className={styles.listItem}>Open a meeting with completed minutes</li>
                      <li className={styles.listItem}>Go to the <strong>Attachments</strong> tab</li>
                      <li className={styles.listItem}>Click <strong>Download DOCX</strong> or <strong>Download PDF</strong></li>
                    </ol>
                    <div className={styles.infoBox}>
                      <Text>
                        <strong>Tip:</strong> DOCX is best for editing; PDF is best for final distribution.
                      </Text>
                    </div>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="history" id="help-history">
                  <AccordionHeader>Viewing Meeting History</AccordionHeader>
                  <AccordionPanel>
                    <p className={styles.paragraph}>
                      The <strong>History</strong> tab provides a complete audit trail of all actions:
                    </p>
                    <ul className={styles.list}>
                      <li className={styles.listItem}>Minutes generated, approved, or rejected</li>
                      <li className={styles.listItem}>Email distributions sent</li>
                      <li className={styles.listItem}>SharePoint archival events</li>
                      <li className={styles.listItem}>Action item status changes</li>
                    </ul>
                    <p className={styles.paragraph}>
                      Each event shows who performed the action and when.
                    </p>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </Card>
          </section>

          {/* What NOT to Do */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Warning24Regular className={styles.sectionIcon} />
              Important Guidelines
            </h2>
            <Card className={styles.card}>
              <div className={styles.warningBox}>
                <Warning24Regular className={styles.warningIcon} />
                <div>
                  <p className={styles.paragraph} style={{ marginBottom: "8px" }}>
                    <strong>Please keep in mind:</strong>
                  </p>
                  <ul className={styles.list}>
                    <li className={styles.listItem}>
                      <strong>Always review AI-generated content</strong> - The AI may occasionally misinterpret 
                      discussions or miss context. Verify accuracy before approving.
                    </li>
                    <li className={styles.listItem} id="help-transcription">
                      <strong>Enable transcription</strong> - The app requires Teams transcription to be enabled 
                      during meetings to generate minutes. Without transcription, minutes cannot be generated.
                    </li>
                    <li className={styles.listItem}>
                      <strong>Don't share credentials</strong> - Never share your Microsoft 365 credentials 
                      with others. Each user should access the app with their own account.
                    </li>
                    <li className={styles.listItem}>
                      <strong>Respect classification levels</strong> - Some meetings may have restricted 
                      access based on security classification. Follow your organization's policies.
                    </li>
                    <li className={styles.listItem} id="help-processing-time">
                      <strong>Wait for processing</strong> - After a meeting ends, wait 5-10 minutes 
                      for the system to fetch transcripts and generate minutes.
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </section>

          {/* Limitations */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <ShieldCheckmark24Regular className={styles.sectionIcon} />
              Limitations
            </h2>
            <Card className={styles.card}>
              <p className={styles.paragraph}>
                Understanding the app's limitations helps set appropriate expectations:
              </p>
              <div className={styles.tableContainer}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Limitation</TableHeaderCell>
                      <TableHeaderCell>Details</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell><strong>Transcription Required</strong></TableCell>
                      <TableCell>
                        Meetings must have transcription enabled in Teams. No transcript means no minutes.
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Meeting Duration</strong></TableCell>
                      <TableCell>
                        Very short meetings (under 5 minutes) may not generate useful minutes.
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Language Support</strong></TableCell>
                      <TableCell>
                        Currently optimized for English. Other languages may have reduced accuracy.
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Processing Time</strong></TableCell>
                      <TableCell>
                        Minutes typically appear 5-10 minutes after meeting ends. Complex meetings may take longer.
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Audio Quality</strong></TableCell>
                      <TableCell>
                        Poor audio quality during meetings may affect transcription and minutes accuracy.
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Teams Only</strong></TableCell>
                      <TableCell>
                        Only works with Microsoft Teams meetings. Does not support Zoom, WebEx, or other platforms.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>
          </section>

          {/* Troubleshooting */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <QuestionCircle24Regular className={styles.sectionIcon} />
              Troubleshooting
            </h2>
            <Card className={styles.card}>
              <Accordion collapsible>
                <AccordionItem value="no-meeting" id="help-no-meeting">
                  <AccordionHeader>Meeting not appearing in the app</AccordionHeader>
                  <AccordionPanel>
                    <ul className={styles.list}>
                      <li className={styles.listItem}>Wait 5-10 minutes after the meeting ends</li>
                      <li className={styles.listItem}>Refresh the dashboard</li>
                      <li className={styles.listItem}>Verify the meeting was a Teams meeting (not a call)</li>
                      <li className={styles.listItem}>Check if you were an attendee or organizer</li>
                    </ul>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="no-minutes" id="help-no-minutes">
                  <AccordionHeader>No minutes generated</AccordionHeader>
                  <AccordionPanel>
                    <ul className={styles.list}>
                      <li className={styles.listItem}>Check if transcription was enabled during the meeting</li>
                      <li className={styles.listItem}>Verify the meeting was longer than 5 minutes</li>
                      <li className={styles.listItem}>The meeting may still be processing - wait and refresh</li>
                      <li className={styles.listItem}>Contact your administrator if the issue persists</li>
                    </ul>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="cant-approve" id="help-cant-approve">
                  <AccordionHeader>Cannot approve minutes</AccordionHeader>
                  <AccordionPanel>
                    <ul className={styles.list}>
                      <li className={styles.listItem}>Verify you have Approver or Admin role</li>
                      <li className={styles.listItem}>Check if the minutes are in "Pending Review" status</li>
                      <li className={styles.listItem}>Minutes may already be approved by another user</li>
                      <li className={styles.listItem}>Contact your administrator to check your permissions</li>
                    </ul>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="export-error">
                  <AccordionHeader>Document download not working</AccordionHeader>
                  <AccordionPanel>
                    <ul className={styles.list}>
                      <li className={styles.listItem}>Ensure minutes are in "Completed" status</li>
                      <li className={styles.listItem}>Check your browser's download settings</li>
                      <li className={styles.listItem}>Try a different browser</li>
                      <li className={styles.listItem}>Clear your browser cache and try again</li>
                    </ul>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem value="login-issue" id="help-login-issue">
                  <AccordionHeader>Authentication or login problems</AccordionHeader>
                  <AccordionPanel>
                    <ul className={styles.list}>
                      <li className={styles.listItem}>Close and reopen Microsoft Teams</li>
                      <li className={styles.listItem}>Clear Teams cache and restart</li>
                      <li className={styles.listItem}>Verify your Microsoft 365 account is active</li>
                      <li className={styles.listItem}>Contact IT support if you see persistent errors</li>
                    </ul>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </Card>
          </section>

          {/* Best Practices */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <People24Regular className={styles.sectionIcon} />
              Best Practices
            </h2>
            <Card className={styles.card}>
              <ul className={styles.list}>
                <li className={styles.listItem}>
                  <strong>Enable transcription early</strong> - Start transcription at the beginning 
                  of each meeting to capture the full discussion.
                </li>
                <li className={styles.listItem}>
                  <strong>Use clear meeting titles</strong> - Descriptive titles like "Q4 Budget Review - Finance" 
                  make it easier to find meetings later.
                </li>
                <li className={styles.listItem}>
                  <strong>State action items clearly</strong> - Say "Action item: [person] will [task] by [date]" 
                  to help the AI identify tasks.
                </li>
                <li className={styles.listItem}>
                  <strong>Review before approving</strong> - Always verify AI-generated content for accuracy 
                  before approving and distributing.
                </li>
                <li className={styles.listItem}>
                  <strong>Update action items promptly</strong> - Keep action item status current to maintain 
                  accurate tracking.
                </li>
              </ul>
            </Card>
          </section>
        </>
      )}

      {selectedTab === "contact" && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <PersonFeedback24Regular className={styles.sectionIcon} />
            Contact Support
          </h2>
          <Card className={styles.card}>
            {formSubmitted ? (
              <div className={styles.successMessage} data-testid="container-success-message">
                <Checkmark24Regular className={styles.successIcon} />
                <div>
                  <Text weight="semibold" style={{ display: "block", marginBottom: "4px" }}>
                    Request Submitted Successfully
                  </Text>
                  <Text>
                    Your support request has been sent. You will receive a response via email within 1-2 business days.
                  </Text>
                  <Button
                    appearance="subtle"
                    style={{ marginTop: "12px" }}
                    onClick={() => setFormSubmitted(false)}
                    data-testid="button-submit-another"
                  >
                    Submit another request
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className={styles.paragraph}>
                  Can't find the answer you're looking for? Submit a support request and our team will 
                  respond via email.
                </p>
                <form onSubmit={handleSubmit} className={styles.contactForm}>
                  <div className={styles.formRow}>
                    <Field label="Subject" required className={styles.formField}>
                      <Input
                        placeholder="Brief description of your issue"
                        value={formData.subject}
                        onChange={(_, data) => setFormData(prev => ({ ...prev, subject: data.value }))}
                        data-testid="input-support-subject"
                      />
                    </Field>
                    <Field label="Category" className={styles.formField}>
                      <Dropdown
                        value={formData.category === "general" ? "General Question" : 
                               formData.category === "bug" ? "Report a Bug" :
                               formData.category === "feature" ? "Feature Request" : "Access Issue"}
                        onOptionSelect={(_, data) => setFormData(prev => ({ 
                          ...prev, 
                          category: data.optionValue as string 
                        }))}
                        data-testid="dropdown-support-category"
                      >
                        <Option value="general">General Question</Option>
                        <Option value="bug">Report a Bug</Option>
                        <Option value="feature">Feature Request</Option>
                        <Option value="access">Access Issue</Option>
                      </Dropdown>
                    </Field>
                  </div>
                  <Field label="Description" required>
                    <Textarea
                      placeholder="Please describe your issue in detail. Include any error messages, steps you've tried, and the meeting name if applicable."
                      value={formData.description}
                      onChange={(_, data) => setFormData(prev => ({ ...prev, description: data.value }))}
                      rows={6}
                      data-testid="textarea-support-description"
                    />
                  </Field>
                  <div className={styles.infoBox}>
                    <Text size={200}>
                      <strong>Tip:</strong> Before submitting, check the User Guide tab for common solutions. 
                      Include specific details like meeting names, dates, and error messages to help us resolve your issue faster.
                    </Text>
                  </div>
                  <Button
                    appearance="primary"
                    type="submit"
                    icon={submitMutation.isPending ? <Spinner size="tiny" /> : <Send24Regular />}
                    disabled={!formData.subject || !formData.description || submitMutation.isPending}
                    className={styles.submitButton}
                    data-testid="button-submit-support"
                  >
                    {submitMutation.isPending ? "Sending..." : "Submit Request"}
                  </Button>
                  {submitMutation.isError && (
                    <Text style={{ color: tokens.colorPaletteRedForeground1, marginTop: "8px" }}>
                      Failed to submit request. Please try again or contact your IT administrator.
                    </Text>
                  )}
                </form>
              </>
            )}
          </Card>
        </section>
      )}

      <Divider />
      
      <p className={styles.version} data-testid="text-help-version">
        Meeting Minutes App v1.1 | Last updated: December 4, 2025
      </p>
    </div>
  );
}
