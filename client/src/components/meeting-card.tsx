import { Card, Button, makeStyles, tokens, shorthands, mergeClasses, Tooltip, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Input, Spinner } from "@fluentui/react-components";
import { Calendar, Clock, Users, FileText, Download, Share2, EyeOff, Eye, Hash, Copy, Check } from "lucide-react";
import { ClassificationBadge } from "./classification-badge";
import { StatusBadge } from "./status-badge";
import { format } from "date-fns";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MeetingWithMinutes } from "@shared/schema";

interface MeetingWithDismissed extends MeetingWithMinutes {
  isDismissed?: boolean;
}

interface MeetingCardProps {
  meeting: MeetingWithDismissed;
  onViewDetails: (meeting: MeetingWithMinutes) => void;
  onDismiss?: (meetingId: string) => void;
  onRestore?: (meetingId: string) => void;
  showDismissButton?: boolean;
}

const useStyles = makeStyles({
  card: {
    ...shorthands.padding("20px"),
    cursor: "pointer",
    transitionProperty: "all",
    transitionDuration: tokens.durationNormal,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      boxShadow: tokens.shadow8,
    },
  },
  header: {
    paddingBottom: "16px",
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
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "8px",
    whiteSpace: "nowrap",
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
  },
  description: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    ...shorthands.overflow("hidden"),
  },
  badgeContainer: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  content: {
    paddingTop: "16px",
    paddingBottom: "16px",
  },
  metadataGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    ...shorthands.gap("12px"),
    "@media (min-width: 768px)": {
      gridTemplateColumns: "1fr 1fr",
    },
  },
  metadataItem: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  metadataIcon: {
    color: tokens.colorNeutralForeground3,
  },
  minutesAvailable: {
    color: tokens.colorPaletteGreenForeground1,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap("8px"),
    flexWrap: "wrap",
    paddingTop: "16px",
  },
  buttonGroup: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  dismissedCard: {
    opacity: 0.6,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  dismissedBadge: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  shareDialogContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
  },
  shareUrlContainer: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  shareUrlInput: {
    flex: 1,
  },
  shareNotice: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding("8px", "12px"),
    ...shorthands.borderRadius("4px"),
  },
});

export function MeetingCard({ meeting, onViewDetails, onDismiss, onRestore, showDismissButton = true }: MeetingCardProps) {
  const styles = useStyles();
  const isDismissed = meeting.isDismissed || false;
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  
  const createShareLink = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/meetings/${meeting.id}/share`);
      return response.json();
    },
    onSuccess: (data) => {
      const baseUrl = window.location.origin;
      setShareUrl(`${baseUrl}${data.shareLink.url}`);
    }
  });

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareDialogOpen(true);
    setCopied(false);
    createShareLink.mutate();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(meeting.id);
  };

  const handleRestore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRestore?.(meeting.id);
  };
  
  return (
    <Card 
      className={mergeClasses(styles.card, isDismissed && styles.dismissedCard)} 
      data-testid={`card-meeting-${meeting.id}`}
    >
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleContainer}>
            <h3 className={styles.title}>
              {meeting.title}
              {isDismissed && <span className={styles.dismissedBadge}> (Hidden)</span>}
            </h3>
            {meeting.description && (
              <p className={styles.description}>
                {meeting.description}
              </p>
            )}
          </div>
          <div className={styles.badgeContainer}>
            <StatusBadge status={meeting.status} />
            <ClassificationBadge level={meeting.classificationLevel} size="sm" />
          </div>
        </div>
      </div>
      
      <div className={styles.content}>
        <div className={styles.metadataGrid}>
          <div className={styles.metadataItem}>
            <Hash className={styles.metadataIcon} style={{ width: "16px", height: "16px" }} />
            <span data-testid={`text-meeting-id-${meeting.id}`}>ID: {meeting.id}</span>
          </div>
          <div className={styles.metadataItem}>
            <Calendar className={styles.metadataIcon} style={{ width: "16px", height: "16px" }} />
            <span>{format(new Date(meeting.scheduledAt), "PPP")}</span>
          </div>
          <div className={styles.metadataItem}>
            <Clock className={styles.metadataIcon} style={{ width: "16px", height: "16px" }} />
            <span>{meeting.duration}</span>
          </div>
          <div className={styles.metadataItem}>
            <Users className={styles.metadataIcon} style={{ width: "16px", height: "16px" }} />
            <span>{meeting.attendees.length} attendees</span>
          </div>
          {meeting.minutes && (
            <div className={mergeClasses(styles.metadataItem, styles.minutesAvailable)}>
              <FileText style={{ width: "16px", height: "16px" }} />
              <span>Minutes available</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <Button
          appearance="primary"
          size="small"
          onClick={() => onViewDetails(meeting)}
          icon={<FileText style={{ width: "16px", height: "16px" }} />}
          data-testid={`button-view-details-${meeting.id}`}
        >
          View Details
        </Button>
        <div className={styles.buttonGroup}>
          {meeting.minutes?.docxUrl && (
            <Button
              appearance="outline"
              size="small"
              icon={<Download style={{ width: "16px", height: "16px" }} />}
              data-testid={`button-download-${meeting.id}`}
            >
              Download
            </Button>
          )}
          {meeting.status === "archived" && (
            <Button
              appearance="outline"
              size="small"
              icon={<Share2 style={{ width: "16px", height: "16px" }} />}
              onClick={handleShare}
              data-testid={`button-share-${meeting.id}`}
            >
              Share
            </Button>
          )}
          {showDismissButton && (
            isDismissed ? (
              <Tooltip content="Restore this meeting to your list" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Eye style={{ width: "16px", height: "16px" }} />}
                  onClick={handleRestore}
                  data-testid={`button-restore-${meeting.id}`}
                >
                  Restore
                </Button>
              </Tooltip>
            ) : (
              <Tooltip content="Hide this meeting from your list" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<EyeOff style={{ width: "16px", height: "16px" }} />}
                  onClick={handleDismiss}
                  data-testid={`button-dismiss-${meeting.id}`}
                >
                  Hide
                </Button>
              </Tooltip>
            )
          )}
        </div>
      </div>

      <Dialog open={shareDialogOpen} onOpenChange={(_, data) => setShareDialogOpen(data.open)}>
        <DialogSurface onClick={(e) => e.stopPropagation()}>
          <DialogBody>
            <DialogTitle>Share Meeting</DialogTitle>
            <DialogContent className={styles.shareDialogContent}>
              <div className={styles.shareNotice}>
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
                <div className={styles.shareUrlContainer}>
                  <Input
                    className={styles.shareUrlInput}
                    value={shareUrl}
                    readOnly
                    data-testid="input-share-url"
                  />
                  <Button
                    appearance="primary"
                    icon={copied ? <Check style={{ width: "16px", height: "16px" }} /> : <Copy style={{ width: "16px", height: "16px" }} />}
                    onClick={handleCopyLink}
                    data-testid="button-copy-share-link"
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button 
                appearance="secondary" 
                onClick={() => setShareDialogOpen(false)}
                data-testid="button-close-share-dialog"
              >
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Card>
  );
}
