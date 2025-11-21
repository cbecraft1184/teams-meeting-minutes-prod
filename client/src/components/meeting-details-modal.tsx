import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { ClassificationBadge } from "./classification-badge";
import { StatusBadge } from "./status-badge";
import { ProcessingStatus } from "./processing-status";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MeetingWithMinutes } from "@shared/schema";

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
    display: "flex",
    flexDirection: "column",
  },
  dialogBody: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 0",
    ...shorthands.overflow("hidden"),
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
    flex: "1 1 0",
    ...shorthands.overflow("auto"),
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
});

export function MeetingDetailsModal({ meeting, open, onOpenChange }: MeetingDetailsModalProps) {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<string>("overview");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();
  
  const handleTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value as string);
  };

  const approveMutation = useMutation({
    mutationFn: async (minutesId: string) => {
      return await apiRequest("POST", `/api/minutes/${minutesId}/approve`, { 
        approvedBy: "current.user@dod.gov" 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({
        title: "Minutes approved",
        description: "Meeting minutes have been approved and distributed to all attendees via email."
      });
      setShowApproveDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve minutes",
        variant: "destructive"
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ minutesId, reason }: { minutesId: string; reason: string }) => {
      return await apiRequest("POST", `/api/minutes/${minutesId}/reject`, { 
        rejectedBy: "current.user@dod.gov",
        reason 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({
        title: "Minutes rejected",
        description: "Meeting minutes have been rejected."
      });
      setShowRejectDialog(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject minutes",
        variant: "destructive"
      });
    }
  });

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
            </TabList>
          </div>

          <div className={styles.tabContent}>
            {selectedTab === "overview" && (
              <div>
                <div className={styles.overviewGrid}>
                  <div className={styles.metadataContainer}>
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
                      {meeting.minutes.processingStatus === "completed" && (
                        <div className={styles.minutesActions}>
                          {showApprovalActions && (
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
                          <Button 
                            appearance="outline" 
                            size="small" 
                            data-testid="button-download-docx"
                            onClick={() => window.open(`/api/meetings/${meeting.id}/export/docx`, '_blank')}
                          >
                            <Download className={mergeClasses(styles.iconMedium, styles.iconWithMargin)} />
                            DOCX
                          </Button>
                          <Button 
                            appearance="outline" 
                            size="small" 
                            data-testid="button-download-pdf"
                            onClick={() => window.open(`/api/meetings/${meeting.id}/export/pdf`, '_blank')}
                          >
                            <Download className={mergeClasses(styles.iconMedium, styles.iconWithMargin)} />
                            PDF
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {meeting.minutes.approvalStatus === "approved" && meeting.minutes.approvedBy && (
                      <div className={styles.approvedBanner}>
                        <Mail className={mergeClasses(styles.metadataIcon, styles.iconMedium)} />
                        <span className={styles.bannerText}>
                          Approved by {meeting.minutes.approvedBy} on {format(new Date(meeting.minutes.approvedAt!), "PPp")}. 
                          Minutes distributed to all attendees via email.
                        </span>
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
                          <p className={styles.listItem}>{meeting.minutes.summary}</p>
                        </div>

                        <Divider />

                        <div className={styles.contentSection}>
                          <h4 className={styles.sectionTitle}>Key Discussions</h4>
                          <ul className={styles.list}>
                            {meeting.minutes.keyDiscussions.map((discussion, index) => (
                              <li key={index} className={styles.listItem}>
                                <span style={{ color: tokens.colorNeutralForeground3 }}>•</span>
                                <span>{discussion}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Divider />

                        <div className={styles.contentSection}>
                          <h4 className={styles.sectionTitle}>Decisions Made</h4>
                          <ul className={styles.list}>
                            {meeting.minutes.decisions.map((decision, index) => (
                              <li key={index} className={styles.listItem}>
                                <CheckCircle2 className={styles.iconDecision} />
                                <span>{decision}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    <FileText className={mergeClasses(styles.emptyIcon, styles.iconLarge, styles.iconCentered)} />
                    <p className={styles.emptyText}>No minutes available for this meeting yet.</p>
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
                              <span>Assigned to: <span style={{ color: tokens.colorNeutralForeground1 }}>{item.assignee}</span></span>
                              {item.dueDate && (
                                <span>Due: <span style={{ color: tokens.colorNeutralForeground1 }}>{format(new Date(item.dueDate), "PP")}</span></span>
                              )}
                            </div>
                          </div>
                          <div className={styles.actionItemBadges}>
                            <Badge 
                              color={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "informative"}
                            >
                              {item.priority}
                            </Badge>
                            <Badge 
                              appearance={item.status === "completed" ? "outline" : "filled"}
                              color="informative"
                            >
                              {item.status}
                            </Badge>
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
              <div className={styles.emptyState}>
                <FileText className={mergeClasses(styles.emptyIcon, styles.iconLarge, styles.iconCentered)} />
                <p className={styles.emptyText}>No attachments available.</p>
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
    </>
  );
}
