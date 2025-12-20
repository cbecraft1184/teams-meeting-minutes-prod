import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  TabList,
  Tab,
  Card,
  Badge,
  Button,
  Divider,
  Textarea,
  makeStyles,
  mergeClasses,
  tokens,
  shorthands,
  SelectTabData,
  SelectTabEvent,
  Toast,
  ToastTitle,
  ToastBody,
  useToastController,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Spinner,
  Input,
} from "@fluentui/react-components";
import { 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  Download, 
  ExternalLink,
  CheckCircle2,
  User,
  ThumbsUp,
  ThumbsDown,
  Mail,
  History,
  CheckCircle,
  AlertCircle,
  ArrowRightCircle,
  XCircle,
  Send,
  Upload,
  Edit,
  RefreshCw,
  ChevronDown,
  Play,
  Circle,
  Hash,
  Share2,
  Copy,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { ClassificationBadge } from "./classification-badge";
import { StatusBadge } from "./status-badge";
import { ProcessingStatus } from "./processing-status";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/authToken";
import type { MeetingWithMinutes, MeetingEvent } from "@shared/schema";
import { APP_TOASTER_ID } from "@/App";

/**
 * Download a meeting document with authentication
 * Works within Teams desktop/mobile by using fetch with auth headers
 */
async function downloadMeetingFile(meetingId: string, format: 'docx' | 'pdf', meetingTitle: string): Promise<void> {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Authentication required. Please refresh the page.');
  }
  
  const response = await fetch(`/api/meetings/${meetingId}/export/${format}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Download failed: ${response.status} ${text}`);
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  
  // Create hidden anchor to trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = `${meetingTitle.replace(/[^a-z0-9]/gi, '_')}_Minutes.${format}`;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

interface MeetingDetailsModalProps {
  meeting: MeetingWithMinutes | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const useStyles = makeStyles({
  dialogSurface: {
    maxWidth: "896px",
    width: "90vw",
    maxHeight: "90vh",
    minHeight: "400px",
    display: "flex",
    flexDirection: "column",
  },
  dialogBody: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minHeight: "0",
    overflowY: "auto",
    overflowX: "hidden",
  },
  header: {
    ...shorthands.padding("24px", "24px", "16px"),
  },
  headerContent: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    ...shorthands.gap("16px"),
    flexWrap: "wrap",
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: "24px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "8px",
  },
  description: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
  },
  badgeContainer: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  tabList: {
    ...shorthands.padding("0", "24px"),
  },
  tabContent: {
    flex: "1 1 auto",
    minHeight: "200px",
    overflowY: "auto",
    overflowX: "hidden",
    ...shorthands.padding("24px"),
  },
  overviewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    ...shorthands.gap("16px"),
    marginBottom: "24px",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "1fr 1fr",
    },
  },
  metadataItem: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
    fontSize: tokens.fontSizeBase300,
  },
  metadataLabel: {
    fontWeight: tokens.fontWeightSemibold,
  },
  metadataValue: {
    color: tokens.colorNeutralForeground1,
  },
  metadataIcon: {
    color: tokens.colorNeutralForeground3,
  },
  link: {
    color: tokens.colorBrandForeground1,
    textDecorationLine: "none",
    ":hover": {
      textDecorationLine: "underline",
    },
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: "12px",
  },
  attendeeList: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap("8px"),
  },
  minutesHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap("16px"),
    flexWrap: "wrap",
    marginBottom: "24px",
  },
  minutesActions: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  statusBadgeGroup: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  approvedBanner: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("12px"),
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
    marginBottom: "24px",
  },
  rejectedBanner: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteRedBorder1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("12px"),
    marginBottom: "24px",
  },
  rejectionLabel: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorPaletteRedForeground1,
    marginBottom: "4px",
  },
  contentSection: {
    marginBottom: "24px",
  },
  list: {
    listStyleType: "none",
    ...shorthands.padding(0),
    ...shorthands.margin(0),
  },
  listItem: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    display: "flex",
    ...shorthands.gap("8px"),
    marginBottom: "8px",
  },
  emptyState: {
    textAlign: "center",
    ...shorthands.padding("48px", "24px"),
  },
  emptyIcon: {
    color: tokens.colorNeutralForeground3,
    marginBottom: "12px",
  },
  emptyText: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
  },
  actionItemSurface: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.padding("16px"),
    marginBottom: "12px",
  },
  actionItemContent: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    ...shorthands.gap("16px"),
    flexWrap: "wrap",
  },
  actionItemText: {
    flex: 1,
    minWidth: 0,
  },
  actionItemTask: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "4px",
  },
  actionItemMeta: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  actionItemBadges: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  nestedDialogSurface: {
    maxWidth: "500px",
  },
  dialogDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    marginBottom: "16px",
  },
  textareaContainer: {
    ...shorthands.margin("16px", "0"),
  },
  metadataContainer: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
    marginBottom: "24px",
  },
  attendeesSection: {
    marginTop: "24px",
  },
  bannerContent: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  bannerText: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  iconSmall: {
    width: "12px",
    height: "12px",
  },
  iconMedium: {
    width: "16px",
    height: "16px",
  },
  iconLarge: {
    width: "48px",
    height: "48px",
  },
  iconWithMargin: {
    marginRight: "8px",
  },
  iconWithSmallMargin: {
    marginRight: "4px",
  },
  iconDecision: {
    width: "16px",
    height: "16px",
    color: tokens.colorPaletteGreenForeground1,
    flexShrink: 0,
    marginTop: "2px",
  },
  iconCentered: {
    margin: "0 auto 12px",
  },
  documentsDescription: {
    color: tokens.colorNeutralForeground3,
    marginBottom: "16px",
  },
  downloadButtonsContainer: {
    display: "flex",
    ...shorthands.gap("12px"),
    flexWrap: "wrap",
  },
  processingIndicator: {
    marginBottom: "12px",
  },
  timeline: {
    position: "relative",
    ...shorthands.padding("0"),
    ...shorthands.margin("0"),
    listStyleType: "none",
  },
  timelineItem: {
    position: "relative",
    ...shorthands.padding("0", "0", "16px", "32px"),
    "::before": {
      content: '""',
      position: "absolute",
      left: "10px",
      top: "24px",
      bottom: "0",
      width: "2px",
      backgroundColor: tokens.colorNeutralStroke2,
    },
    "&:last-child::before": {
      display: "none",
    },
  },
  timelineIcon: {
    position: "absolute",
    left: "0",
    top: "0",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("2px", "solid", tokens.colorNeutralStroke2),
  },
  timelineIconSuccess: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    ...shorthands.border("2px", "solid", tokens.colorPaletteGreenBorder1),
  },
  timelineIconWarning: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    ...shorthands.border("2px", "solid", tokens.colorPaletteYellowBorder1),
  },
  timelineIconError: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    ...shorthands.border("2px", "solid", tokens.colorPaletteRedBorder1),
  },
  timelineIconInfo: {
    backgroundColor: tokens.colorPaletteBlueBorderActive,
    ...shorthands.border("2px", "solid", tokens.colorBrandStroke1),
  },
  timelineContent: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("12px", "16px"),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
  },
  timelineTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "4px",
  },
  timelineDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    marginBottom: "8px",
  },
  timelineMeta: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    flexWrap: "wrap",
  },
  timelineMetaItem: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("4px"),
  },
  loadingSpinner: {
    display: "flex",
    justifyContent: "center",
    ...shorthands.padding("48px"),
  },
});

interface UserInfo {
  user: {
    id: string;
    email: string;
    role: string;
    clearanceLevel: string;
  };
  permissions?: {
    role: string;
  };
}

export function MeetingDetailsModal({ meeting, open, onOpenChange }: MeetingDetailsModalProps) {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<string>("overview");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { dispatchToast } = useToastController(APP_TOASTER_ID);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedDiscussions, setEditedDiscussions] = useState<string[]>([]);
  const [editedDecisions, setEditedDecisions] = useState<string[]>([]);
  
  // Initialize edit fields when entering edit mode
  const enterEditMode = () => {
    if (meeting?.minutes) {
      setEditedSummary(meeting.minutes.summary || "");
      setEditedDiscussions([...(meeting.minutes.keyDiscussions || [])]);
      setEditedDecisions([...(meeting.minutes.decisions || [])]);
      setIsEditMode(true);
    }
  };
  
  const cancelEditMode = () => {
    setIsEditMode(false);
    setEditedSummary("");
    setEditedDiscussions([]);
    setEditedDecisions([]);
  };
  
  // Fetch user info to check admin status
  const { data: userInfo } = useQuery<UserInfo>({
    queryKey: ["/api/user/me"],
  });
  const isAdmin = userInfo?.user?.role === "admin";
  
  // Share link mutation
  const createShareLink = useMutation({
    mutationFn: async () => {
      if (!meeting) throw new Error("No meeting selected");
      const response = await apiRequest("POST", `/api/meetings/${meeting.id}/share`);
      return response.json();
    },
    onSuccess: (data) => {
      const baseUrl = window.location.origin;
      setShareUrl(`${baseUrl}${data.shareLink.url}`);
    },
    onError: (error: any) => {
      dispatchToast(
        <Toast>
          <ToastTitle>Error</ToastTitle>
          <ToastBody>{error.message || "Failed to create share link"}</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    }
  });

  const handleShare = () => {
    setShareDialogOpen(true);
    setCopied(false);
    createShareLink.mutate();
  };

  const handleCopyShareUrl = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value as string);
  };

  const approveMutation = useMutation({
    mutationFn: async (minutesId: string) => {
      return await apiRequest("POST", `/api/minutes/${minutesId}/approve`, { 
        approvedBy: "current.user@contoso.com" 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      dispatchToast(
        <Toast>
          <ToastTitle>Minutes approved</ToastTitle>
          <ToastBody>Meeting minutes have been approved and distributed to all attendees via email.</ToastBody>
        </Toast>,
        { intent: "success" }
      );
      setShowApproveDialog(false);
    },
    onError: (error: any) => {
      dispatchToast(
        <Toast>
          <ToastTitle>Error</ToastTitle>
          <ToastBody>{error.message || "Failed to approve minutes"}</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ minutesId, reason }: { minutesId: string; reason: string }) => {
      return await apiRequest("POST", `/api/minutes/${minutesId}/reject`, { 
        rejectedBy: "current.user@contoso.com",
        reason 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      dispatchToast(
        <Toast>
          <ToastTitle>Minutes rejected</ToastTitle>
          <ToastBody>Meeting minutes have been rejected.</ToastBody>
        </Toast>,
        { intent: "success" }
      );
      setShowRejectDialog(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      dispatchToast(
        <Toast>
          <ToastTitle>Error</ToastTitle>
          <ToastBody>{error.message || "Failed to reject minutes"}</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    }
  });

  // Edit minutes content mutation
  const editMinutesMutation = useMutation({
    mutationFn: async ({ minutesId, summary, keyDiscussions, decisions }: { 
      minutesId: string; 
      summary: string; 
      keyDiscussions: string[]; 
      decisions: string[];
    }) => {
      return await apiRequest("PATCH", `/api/minutes/${minutesId}`, { 
        summary, 
        keyDiscussions, 
        decisions 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      dispatchToast(
        <Toast>
          <ToastTitle>Minutes updated</ToastTitle>
          <ToastBody>Meeting minutes have been saved successfully.</ToastBody>
        </Toast>,
        { intent: "success" }
      );
      setIsEditMode(false);
    },
    onError: (error: any) => {
      dispatchToast(
        <Toast>
          <ToastTitle>Error</ToastTitle>
          <ToastBody>{error.message || "Failed to update minutes"}</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    }
  });

  const saveMinutesEdits = () => {
    if (meeting?.minutes) {
      editMinutesMutation.mutate({
        minutesId: meeting.minutes.id,
        summary: editedSummary,
        keyDiscussions: editedDiscussions.filter(d => d.trim() !== ""),
        decisions: editedDecisions.filter(d => d.trim() !== "")
      });
    }
  };

  // Action item status update mutation
  const updateActionItemMutation = useMutation({
    mutationFn: async ({ actionItemId, status }: { actionItemId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/action-items/${actionItemId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      dispatchToast(
        <Toast>
          <ToastTitle>Action item updated</ToastTitle>
          <ToastBody>The action item status has been updated.</ToastBody>
        </Toast>,
        { intent: "success" }
      );
    },
    onError: (error: any) => {
      dispatchToast(
        <Toast>
          <ToastTitle>Error</ToastTitle>
          <ToastBody>{error.message || "Failed to update action item"}</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    }
  });

  // Resend email mutation for approved meetings
  const resendEmailMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      return await apiRequest("POST", `/api/meetings/${meetingId}/resend-email`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      dispatchToast(
        <Toast>
          <ToastTitle>Email resent</ToastTitle>
          <ToastBody>Meeting minutes are being sent to all attendees.</ToastBody>
        </Toast>,
        { intent: "success" }
      );
    },
    onError: (error: any) => {
      dispatchToast(
        <Toast>
          <ToastTitle>Error</ToastTitle>
          <ToastBody>{error.message || "Failed to resend email"}</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    }
  });

  // Reprocess mutation to regenerate minutes
  const reprocessMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      return await apiRequest("POST", `/api/admin/meetings/${meetingId}/reprocess`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      dispatchToast(
        <Toast>
          <ToastTitle>Reprocessing started</ToastTitle>
          <ToastBody>Meeting minutes are being generated. This may take a moment.</ToastBody>
        </Toast>,
        { intent: "success" }
      );
    },
    onError: (error: any) => {
      dispatchToast(
        <Toast>
          <ToastTitle>Error</ToastTitle>
          <ToastBody>{error.message || "Failed to reprocess meeting"}</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    }
  });

  // Fetch meeting events for history tab
  const { data: events = [], isLoading: eventsLoading } = useQuery<MeetingEvent[]>({
    queryKey: ["/api/meetings", meeting?.id, "events"],
    enabled: !!meeting?.id && selectedTab === "history",
  });

  // Helper function to get icon for event type
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "meeting_created":
        return <Calendar className={styles.iconSmall} />;
      case "minutes_generated":
        return <FileText className={styles.iconSmall} />;
      case "minutes_approved":
        return <CheckCircle className={styles.iconSmall} />;
      case "minutes_rejected":
        return <XCircle className={styles.iconSmall} />;
      case "minutes_regenerated":
        return <RefreshCw className={styles.iconSmall} />;
      case "email_sent":
        return <Send className={styles.iconSmall} />;
      case "sharepoint_uploaded":
        return <Upload className={styles.iconSmall} />;
      case "processing_completed":
        return <CheckCircle className={styles.iconSmall} />;
      case "processing_skipped":
        return <AlertCircle className={styles.iconSmall} />;
      case "action_item_created":
      case "action_item_updated":
      case "action_item_completed":
        return <CheckCircle2 className={styles.iconSmall} />;
      default:
        return <ArrowRightCircle className={styles.iconSmall} />;
    }
  };

  // Helper function to get icon style for event type
  const getEventIconStyle = (eventType: string) => {
    switch (eventType) {
      case "minutes_approved":
      case "processing_completed":
      case "action_item_completed":
        return mergeClasses(styles.timelineIcon, styles.timelineIconSuccess);
      case "minutes_rejected":
      case "processing_skipped":
        return mergeClasses(styles.timelineIcon, styles.timelineIconError);
      case "email_sent":
      case "sharepoint_uploaded":
        return mergeClasses(styles.timelineIcon, styles.timelineIconInfo);
      default:
        return styles.timelineIcon;
    }
  };

  if (!meeting) return null;

  const showApprovalActions = meeting.minutes?.processingStatus === "completed" && 
    meeting.minutes?.approvalStatus === "pending_review";

  return (
    <>
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className={styles.dialogSurface} data-testid="modal-meeting-details">
        <DialogBody className={styles.dialogBody}>
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <div className={styles.titleContainer}>
                <DialogTitle className={styles.title}>
                  {meeting.title}
                </DialogTitle>
                {meeting.description && (
                  <p className={styles.description}>{meeting.description}</p>
                )}
              </div>
              <div className={styles.badgeContainer}>
                <StatusBadge status={meeting.status} />
                <ClassificationBadge level={meeting.classificationLevel} />
                {meeting.status === "archived" && (
                  <Button
                    appearance="outline"
                    size="small"
                    icon={<Share2 style={{ width: "16px", height: "16px" }} />}
                    onClick={handleShare}
                    data-testid="button-share-modal"
                  >
                    Share
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Divider />

          <div className={styles.tabList}>
            <TabList selectedValue={selectedTab} onTabSelect={handleTabSelect}>
              <Tab value="overview" data-testid="tab-overview">Overview</Tab>
              <Tab value="minutes" data-testid="tab-minutes">Minutes</Tab>
              <Tab value="actions" data-testid="tab-actions">Action Items</Tab>
              <Tab value="attachments" data-testid="tab-attachments">Attachments</Tab>
              <Tab value="history" data-testid="tab-history">History</Tab>
            </TabList>
          </div>

          <div className={styles.tabContent}>
            {selectedTab === "overview" && (
              <div>
                <div className={styles.overviewGrid}>
                  <div className={styles.metadataContainer}>
                    <div className={styles.metadataItem}>
                      <Hash className={mergeClasses(styles.metadataIcon, styles.iconMedium)} />
                      <span className={styles.metadataLabel}>Meeting ID:</span>
                      <span className={styles.metadataValue} data-testid="text-meeting-id">{meeting.id}</span>
                    </div>
                    <div className={styles.metadataItem}>
                      <Calendar className={mergeClasses(styles.metadataIcon, styles.iconMedium)} />
                      <span className={styles.metadataLabel}>Date:</span>
                      <span className={styles.metadataValue}>{format(new Date(meeting.scheduledAt), "PPP")}</span>
                    </div>
                    <div className={styles.metadataItem}>
                      <Clock className={mergeClasses(styles.metadataIcon, styles.iconMedium)} />
                      <span className={styles.metadataLabel}>Duration:</span>
                      <span className={styles.metadataValue}>{meeting.duration}</span>
                    </div>
                    <div className={styles.metadataItem}>
                      <Users className={mergeClasses(styles.metadataIcon, styles.iconMedium)} />
                      <span className={styles.metadataLabel}>Attendees:</span>
                      <span className={styles.metadataValue}>{meeting.attendees.length} participants</span>
                    </div>
                  </div>
                  
                  {meeting.minutes && (
                    <div className={styles.metadataContainer}>
                      <div className={styles.metadataItem}>
                        <FileText className={mergeClasses(styles.metadataIcon, styles.iconMedium)} />
                        <span className={styles.metadataLabel}>Processing:</span>
                        <ProcessingStatus status={meeting.minutes.processingStatus} />
                      </div>
                      {meeting.minutes.sharepointUrl && (
                        <div className={styles.metadataItem}>
                          <ExternalLink className={mergeClasses(styles.metadataIcon, styles.iconMedium)} />
                          <span className={styles.metadataLabel}>SharePoint:</span>
                          <a 
                            href={meeting.minutes.sharepointUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.link}
                          >
                            View in SharePoint
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Divider />

                <div className={styles.attendeesSection}>
                  <h4 className={styles.sectionTitle}>Attendees</h4>
                  <div className={styles.attendeeList}>
                    {meeting.attendees.map((attendee, index) => (
                      <Badge key={index} appearance="outline" data-testid={`badge-attendee-${index}`}>
                        <User className={mergeClasses(styles.iconSmall, styles.iconWithSmallMargin)} />
                        {attendee}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedTab === "minutes" && (
              <div>
                {meeting.minutes ? (
                  <>
                    <div className={styles.minutesHeader}>
                      <div className={styles.statusBadgeGroup}>
                        <ProcessingStatus status={meeting.minutes.processingStatus} />
                        {meeting.minutes.approvalStatus && (
                          <Badge 
                            color={
                              meeting.minutes.approvalStatus === "approved" ? "success" :
                              meeting.minutes.approvalStatus === "rejected" ? "danger" :
                              "informative"
                            }
                            data-testid="badge-approval-status"
                          >
                            {meeting.minutes.approvalStatus === "pending_review" ? "Pending Review" :
                             meeting.minutes.approvalStatus === "approved" ? "Approved" :
                             meeting.minutes.approvalStatus === "rejected" ? "Rejected" :
                             "Revision Requested"}
                          </Badge>
                        )}
                      </div>
                      <div className={styles.minutesActions}>
                        {showApprovalActions && meeting.minutes.processingStatus === "completed" && (
                          <>
                            <Button 
                              appearance="primary" 
                              size="small" 
                              data-testid="button-approve"
                              onClick={() => setShowApproveDialog(true)}
                            >
                              <ThumbsUp className={mergeClasses(styles.iconMedium, styles.iconWithMargin)} />
                              Approve & Distribute
                            </Button>
                            <Button 
                              appearance="primary" 
                              size="small" 
                              data-testid="button-reject"
                              onClick={() => setShowRejectDialog(true)}
                            >
                              <ThumbsDown className={mergeClasses(styles.iconMedium, styles.iconWithMargin)} />
                              Reject
                            </Button>
                          </>
                        )}
                        {isAdmin && (
                          <Button 
                            appearance="secondary" 
                            size="small" 
                            data-testid="button-regenerate-minutes"
                            disabled={reprocessMutation.isPending}
                            onClick={() => reprocessMutation.mutate(meeting.id)}
                          >
                            {reprocessMutation.isPending ? (
                              <Spinner size="tiny" style={{ marginRight: "4px" }} />
                            ) : (
                              <RefreshCw className={mergeClasses(styles.iconSmall, styles.iconWithSmallMargin)} />
                            )}
                            {reprocessMutation.isPending ? "Regenerating..." : "Regenerate"}
                          </Button>
                        )}
                        {/* Edit button - only show when not approved and not in edit mode */}
                        {meeting.minutes.approvalStatus !== "approved" && !isEditMode && (
                          <Button 
                            appearance="secondary" 
                            size="small" 
                            data-testid="button-edit-minutes"
                            onClick={enterEditMode}
                          >
                            <Edit className={mergeClasses(styles.iconSmall, styles.iconWithSmallMargin)} />
                            Edit
                          </Button>
                        )}
                        {/* Save/Cancel buttons in edit mode */}
                        {isEditMode && (
                          <>
                            <Button 
                              appearance="primary" 
                              size="small" 
                              data-testid="button-save-minutes"
                              disabled={editMinutesMutation.isPending}
                              onClick={saveMinutesEdits}
                            >
                              {editMinutesMutation.isPending ? (
                                <Spinner size="tiny" style={{ marginRight: "4px" }} />
                              ) : (
                                <Check className={mergeClasses(styles.iconSmall, styles.iconWithSmallMargin)} />
                              )}
                              {editMinutesMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button 
                              appearance="secondary" 
                              size="small" 
                              data-testid="button-cancel-edit"
                              onClick={cancelEditMode}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {meeting.minutes.approvalStatus === "approved" && meeting.minutes.approvedBy && (
                      <div className={styles.approvedBanner}>
                        <div className={styles.bannerContent} style={{ flex: 1 }}>
                          <Mail className={mergeClasses(styles.metadataIcon, styles.iconMedium)} />
                          <span className={styles.bannerText}>
                            Approved by {meeting.minutes.approvedBy} on {format(new Date(meeting.minutes.approvedAt!), "PPp")}. 
                            Minutes distributed to all attendees via email.
                          </span>
                        </div>
                        <Button
                          appearance="secondary"
                          size="small"
                          data-testid="button-resend-email"
                          disabled={resendEmailMutation.isPending}
                          onClick={() => resendEmailMutation.mutate(meeting.id)}
                        >
                          {resendEmailMutation.isPending ? (
                            <Spinner size="tiny" />
                          ) : (
                            <>
                              <RefreshCw className={mergeClasses(styles.iconSmall, styles.iconWithSmallMargin)} />
                              Resend Email
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    
                    {meeting.minutes.approvalStatus === "rejected" && meeting.minutes.rejectionReason && (
                      <div className={styles.rejectedBanner}>
                        <p className={styles.rejectionLabel}>Rejection Reason:</p>
                        <p className={styles.bannerText}>{meeting.minutes.rejectionReason}</p>
                      </div>
                    )}

                    {meeting.minutes.processingStatus === "completed" && (
                      <>
                        <div className={styles.contentSection}>
                          <h4 className={styles.sectionTitle}>Summary</h4>
                          {isEditMode ? (
                            <Textarea
                              data-testid="input-edit-summary"
                              value={editedSummary}
                              onChange={(e, data) => setEditedSummary(data.value)}
                              style={{ width: "100%", minHeight: "100px" }}
                            />
                          ) : (
                            <p className={styles.listItem}>{meeting.minutes.summary}</p>
                          )}
                        </div>

                        <Divider />

                        <div className={styles.contentSection}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h4 className={styles.sectionTitle}>Key Discussions</h4>
                            {isEditMode && (
                              <Button
                                appearance="subtle"
                                size="small"
                                data-testid="button-add-discussion"
                                onClick={() => setEditedDiscussions([...editedDiscussions, ""])}
                              >
                                + Add
                              </Button>
                            )}
                          </div>
                          {isEditMode ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {editedDiscussions.map((discussion, index) => (
                                <div key={index} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                  <Input
                                    data-testid={`input-edit-discussion-${index}`}
                                    value={discussion}
                                    onChange={(e, data) => {
                                      const updated = [...editedDiscussions];
                                      updated[index] = data.value;
                                      setEditedDiscussions(updated);
                                    }}
                                    style={{ flex: 1 }}
                                  />
                                  <Button
                                    appearance="subtle"
                                    size="small"
                                    data-testid={`button-remove-discussion-${index}`}
                                    onClick={() => {
                                      const updated = editedDiscussions.filter((_, i) => i !== index);
                                      setEditedDiscussions(updated);
                                    }}
                                  >
                                    <XCircle className={styles.iconSmall} />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <ul className={styles.list}>
                              {meeting.minutes.keyDiscussions.map((discussion, index) => (
                                <li key={index} className={styles.listItem}>
                                  <span style={{ color: tokens.colorNeutralForeground3 }}>•</span>
                                  <span>{discussion}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <Divider />

                        <div className={styles.contentSection}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h4 className={styles.sectionTitle}>Decisions Made</h4>
                            {isEditMode && (
                              <Button
                                appearance="subtle"
                                size="small"
                                data-testid="button-add-decision"
                                onClick={() => setEditedDecisions([...editedDecisions, ""])}
                              >
                                + Add
                              </Button>
                            )}
                          </div>
                          {isEditMode ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {editedDecisions.map((decision, index) => (
                                <div key={index} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                  <Input
                                    data-testid={`input-edit-decision-${index}`}
                                    value={decision}
                                    onChange={(e, data) => {
                                      const updated = [...editedDecisions];
                                      updated[index] = data.value;
                                      setEditedDecisions(updated);
                                    }}
                                    style={{ flex: 1 }}
                                  />
                                  <Button
                                    appearance="subtle"
                                    size="small"
                                    data-testid={`button-remove-decision-${index}`}
                                    onClick={() => {
                                      const updated = editedDecisions.filter((_, i) => i !== index);
                                      setEditedDecisions(updated);
                                    }}
                                  >
                                    <XCircle className={styles.iconSmall} />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <ul className={styles.list}>
                              {meeting.minutes.decisions.map((decision, index) => (
                                <li key={index} className={styles.listItem}>
                                  <CheckCircle2 className={styles.iconDecision} />
                                  <span>{decision}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    <FileText className={mergeClasses(styles.emptyIcon, styles.iconLarge, styles.iconCentered)} />
                    <p className={styles.emptyText}>No minutes available for this meeting yet.</p>
                    {meeting.status === "completed" && (
                      <Button
                        appearance="primary"
                        size="medium"
                        style={{ marginTop: "16px" }}
                        data-testid="button-reprocess"
                        disabled={reprocessMutation.isPending}
                        onClick={() => reprocessMutation.mutate(meeting.id)}
                      >
                        {reprocessMutation.isPending ? (
                          <Spinner size="tiny" style={{ marginRight: "8px" }} />
                        ) : (
                          <RefreshCw className={mergeClasses(styles.iconMedium, styles.iconWithMargin)} />
                        )}
                        {reprocessMutation.isPending ? "Processing..." : "Generate Minutes"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedTab === "actions" && (
              <div>
                {meeting.actionItems && meeting.actionItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {meeting.actionItems.map((item) => (
                      <div key={item.id} className={styles.actionItemSurface} data-testid={`card-action-item-${item.id}`}>
                        <div className={styles.actionItemContent}>
                          <div className={styles.actionItemText}>
                            <p className={styles.actionItemTask}>{item.task}</p>
                            <div className={styles.actionItemMeta}>
                              <span>
                                <User className={mergeClasses(styles.iconSmall, styles.iconWithSmallMargin)} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                {item.assignee}
                              </span>
                              {item.dueDate && (
                                <span>
                                  <Calendar className={mergeClasses(styles.iconSmall, styles.iconWithSmallMargin)} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                  {format(new Date(item.dueDate), "PP")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={styles.actionItemBadges}>
                            <Badge 
                              color={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "informative"}
                            >
                              {item.priority}
                            </Badge>
                            <Menu>
                              <MenuTrigger disableButtonEnhancement>
                                <Button 
                                  appearance="subtle"
                                  size="small"
                                  data-testid={`button-status-${item.id}`}
                                  disabled={updateActionItemMutation.isPending}
                                >
                                  {item.status === "pending" && <Circle className={styles.iconSmall} style={{ marginRight: '4px' }} />}
                                  {item.status === "in_progress" && <Play className={styles.iconSmall} style={{ marginRight: '4px' }} />}
                                  {item.status === "completed" && <CheckCircle className={styles.iconSmall} style={{ marginRight: '4px' }} />}
                                  {item.status === "pending" ? "Pending" : item.status === "in_progress" ? "In Progress" : "Completed"}
                                  <ChevronDown className={styles.iconSmall} style={{ marginLeft: '4px' }} />
                                </Button>
                              </MenuTrigger>
                              <MenuPopover>
                                <MenuList>
                                  <MenuItem 
                                    data-testid={`menu-item-pending-${item.id}`}
                                    onClick={() => updateActionItemMutation.mutate({ actionItemId: item.id, status: "pending" })}
                                    disabled={item.status === "pending"}
                                  >
                                    <Circle className={styles.iconSmall} style={{ marginRight: '8px' }} />
                                    Pending
                                  </MenuItem>
                                  <MenuItem 
                                    data-testid={`menu-item-in-progress-${item.id}`}
                                    onClick={() => updateActionItemMutation.mutate({ actionItemId: item.id, status: "in_progress" })}
                                    disabled={item.status === "in_progress"}
                                  >
                                    <Play className={styles.iconSmall} style={{ marginRight: '8px' }} />
                                    In Progress
                                  </MenuItem>
                                  <MenuItem 
                                    data-testid={`menu-item-completed-${item.id}`}
                                    onClick={() => updateActionItemMutation.mutate({ actionItemId: item.id, status: "completed" })}
                                    disabled={item.status === "completed"}
                                  >
                                    <CheckCircle className={styles.iconSmall} style={{ marginRight: '8px' }} />
                                    Completed
                                  </MenuItem>
                                </MenuList>
                              </MenuPopover>
                            </Menu>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <CheckCircle2 className={mergeClasses(styles.emptyIcon, styles.iconLarge, styles.iconCentered)} />
                    <p className={styles.emptyText}>No action items for this meeting.</p>
                  </div>
                )}
              </div>
            )}

            {selectedTab === "attachments" && (
              <div>
                {meeting.minutes ? (
                  <div className={styles.contentSection}>
                    <h4 className={styles.sectionTitle}>Meeting Documents</h4>
                    <p className={styles.documentsDescription}>
                      Download the meeting minutes in your preferred format:
                    </p>
                    {meeting.minutes.processingStatus !== "completed" && (
                      <div className={styles.processingIndicator}>
                        <ProcessingStatus status={meeting.minutes.processingStatus} />
                      </div>
                    )}
                    <div className={styles.downloadButtonsContainer}>
                      <Button 
                        appearance="outline" 
                        size="medium" 
                        data-testid="button-download-docx"
                        onClick={async () => {
                          try {
                            await downloadMeetingFile(meeting.id, 'docx', meeting.title);
                            dispatchToast(
                              <Toast>
                                <ToastTitle>Download Complete</ToastTitle>
                                <ToastBody>DOCX file downloaded successfully.</ToastBody>
                              </Toast>,
                              { intent: "success" }
                            );
                          } catch (error: any) {
                            dispatchToast(
                              <Toast>
                                <ToastTitle>Download Failed</ToastTitle>
                                <ToastBody>{error.message}</ToastBody>
                              </Toast>,
                              { intent: "error" }
                            );
                          }
                        }}
                        disabled={meeting.minutes.processingStatus !== "completed"}
                      >
                        <Download className={mergeClasses(styles.iconMedium, styles.iconWithMargin)} />
                        Download DOCX
                      </Button>
                      <Button 
                        appearance="outline" 
                        size="medium" 
                        data-testid="button-download-pdf"
                        onClick={async () => {
                          try {
                            await downloadMeetingFile(meeting.id, 'pdf', meeting.title);
                            dispatchToast(
                              <Toast>
                                <ToastTitle>Download Complete</ToastTitle>
                                <ToastBody>PDF file downloaded successfully.</ToastBody>
                              </Toast>,
                              { intent: "success" }
                            );
                          } catch (error: any) {
                            dispatchToast(
                              <Toast>
                                <ToastTitle>Download Failed</ToastTitle>
                                <ToastBody>{error.message}</ToastBody>
                              </Toast>,
                              { intent: "error" }
                            );
                          }
                        }}
                        disabled={meeting.minutes.processingStatus !== "completed"}
                      >
                        <Download className={mergeClasses(styles.iconMedium, styles.iconWithMargin)} />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <FileText className={mergeClasses(styles.emptyIcon, styles.iconLarge, styles.iconCentered)} />
                    <p className={styles.emptyText}>No documents available yet.</p>
                  </div>
                )}
              </div>
            )}

            {selectedTab === "history" && (
              <div data-testid="container-history">
                {eventsLoading ? (
                  <div className={styles.loadingSpinner} data-testid="loading-history">
                    <Badge appearance="outline">Loading history...</Badge>
                  </div>
                ) : events.length === 0 ? (
                  <div className={styles.emptyState} data-testid="empty-history">
                    <History className={mergeClasses(styles.emptyIcon, styles.iconLarge, styles.iconCentered)} />
                    <p className={styles.emptyText} data-testid="text-empty-history">No event history recorded yet.</p>
                    <p className={styles.emptyText} style={{ marginTop: "8px", fontSize: "12px" }}>
                      Events will be recorded as the meeting progresses through its lifecycle.
                    </p>
                  </div>
                ) : (
                  <ul className={styles.timeline} data-testid="timeline-events">
                    {events.map((event, index) => (
                      <li key={event.id} className={styles.timelineItem} data-testid={`timeline-event-${event.id}`}>
                        <div className={getEventIconStyle(event.eventType)} data-testid={`timeline-icon-${event.id}`}>
                          {getEventIcon(event.eventType)}
                        </div>
                        <div className={styles.timelineContent}>
                          <h4 className={styles.timelineTitle} data-testid={`timeline-title-${event.id}`}>{event.title}</h4>
                          {event.description && (
                            <p className={styles.timelineDescription} data-testid={`timeline-description-${event.id}`}>{event.description}</p>
                          )}
                          <div className={styles.timelineMeta}>
                            <span className={styles.timelineMetaItem} data-testid={`timeline-time-${event.id}`}>
                              <Clock className={styles.iconSmall} />
                              {format(new Date(event.occurredAt), "PPp")}
                            </span>
                            {event.actorName && (
                              <span className={styles.timelineMetaItem} data-testid={`timeline-actor-${event.id}`}>
                                <User className={styles.iconSmall} />
                                {event.actorName}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </DialogBody>
      </DialogSurface>
    </Dialog>

    <Dialog open={showApproveDialog} onOpenChange={(_, data) => setShowApproveDialog(data.open)}>
      <DialogSurface className={styles.nestedDialogSurface}>
        <DialogBody>
          <DialogTitle>Approve Meeting Minutes?</DialogTitle>
          <DialogContent>
            <p className={styles.dialogDescription}>
              This will approve the meeting minutes and automatically distribute them to all attendees via email 
              with DOCX and PDF attachments. This action cannot be undone.
            </p>
          </DialogContent>
          <DialogActions>
            <Button 
              appearance="secondary" 
              onClick={() => setShowApproveDialog(false)}
              data-testid="button-cancel-approve"
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={() => meeting.minutes && approveMutation.mutate(meeting.minutes.id)}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Approve & Distribute"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>

    <Dialog open={showRejectDialog} onOpenChange={(_, data) => setShowRejectDialog(data.open)}>
      <DialogSurface className={styles.nestedDialogSurface}>
        <DialogBody>
          <DialogTitle>Reject Meeting Minutes?</DialogTitle>
          <DialogContent>
            <p className={styles.dialogDescription}>
              Please provide a reason for rejecting these meeting minutes.
            </p>
            <div className={styles.textareaContainer}>
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                data-testid="input-rejection-reason"
              />
            </div>
          </DialogContent>
          <DialogActions>
            <Button 
              appearance="secondary" 
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason("");
              }}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={() => meeting.minutes && rejectMutation.mutate({
                minutesId: meeting.minutes.id,
                reason: rejectionReason
              })}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Minutes"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>

    <Dialog open={shareDialogOpen} onOpenChange={(_, data) => setShareDialogOpen(data.open)}>
      <DialogSurface className={styles.nestedDialogSurface}>
        <DialogBody>
          <DialogTitle>Share Meeting</DialogTitle>
          <DialogContent>
            <div style={{ 
              backgroundColor: tokens.colorPaletteYellowBackground2,
              padding: "12px",
              borderRadius: tokens.borderRadiusMedium,
              marginBottom: "16px",
              fontSize: tokens.fontSizeBase200
            }}>
              This link can only be accessed by members of your organization.
            </div>
            
            {createShareLink.isPending ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Spinner size="tiny" />
                <span>Creating share link...</span>
              </div>
            ) : createShareLink.isError ? (
              <div style={{ color: tokens.colorPaletteRedForeground1 }}>
                Failed to create share link. Please try again.
              </div>
            ) : shareUrl ? (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Input
                  value={shareUrl}
                  readOnly
                  style={{ flex: 1 }}
                  data-testid="input-share-url"
                />
                <Button
                  appearance="primary"
                  icon={copied ? <Check style={{ width: "16px", height: "16px" }} /> : <Copy style={{ width: "16px", height: "16px" }} />}
                  onClick={handleCopyShareUrl}
                  data-testid="button-copy-share-link"
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button 
              appearance="secondary" 
              onClick={() => setShareDialogOpen(false)}
              data-testid="button-close-share"
            >
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
    </>
  );
}
