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
  actionItemCard: {
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
  alertDialogContent: {
    maxWidth: "500px",
  },
  alertDialogDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    marginBottom: "16px",
  },
  alertDialogTextarea: {
    ...shorthands.margin("16px", "0"),
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Date:</span>
                    <span className="text-foreground">{format(new Date(meeting.scheduledAt), "PPP")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Duration:</span>
                    <span className="text-foreground">{meeting.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Attendees:</span>
                    <span className="text-foreground">{meeting.attendees.length} participants</span>
                  </div>
                </div>
                
                {meeting.minutes && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Processing:</span>
                      <ProcessingStatus status={meeting.minutes.processingStatus} />
                    </div>
                    {meeting.minutes.sharepointUrl && (
                      <div className="flex items-center gap-2 text-sm">
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">SharePoint:</span>
                        <a 
                          href={meeting.minutes.sharepointUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View in SharePoint
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-3">Attendees</h4>
                <div className="flex flex-wrap gap-2">
                  {meeting.attendees.map((attendee, index) => (
                    <Badge key={index} variant="secondary" data-testid={`badge-attendee-${index}`}>
                      <User className="w-3 h-3 mr-1" />
                      {attendee}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="minutes" className="px-6 pb-6 space-y-6">
              {meeting.minutes ? (
                <>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ProcessingStatus status={meeting.minutes.processingStatus} />
                      {meeting.minutes.approvalStatus && (
                        <Badge 
                          variant={
                            meeting.minutes.approvalStatus === "approved" ? "default" :
                            meeting.minutes.approvalStatus === "rejected" ? "destructive" :
                            "secondary"
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
                      <div className="flex items-center gap-2">
                        {showApprovalActions && (
                          <>
                            <Button 
                              variant="default" 
                              size="sm" 
                              data-testid="button-approve"
                              onClick={() => setShowApproveDialog(true)}
                            >
                              <ThumbsUp className="w-4 h-4 mr-2" />
                              Approve & Distribute
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              data-testid="button-reject"
                              onClick={() => setShowRejectDialog(true)}
                            >
                              <ThumbsDown className="w-4 h-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          data-testid="button-download-docx"
                          onClick={() => window.open(`/api/meetings/${meeting.id}/export/docx`, '_blank')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          DOCX
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          data-testid="button-download-pdf"
                          onClick={() => window.open(`/api/meetings/${meeting.id}/export/pdf`, '_blank')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          PDF
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {meeting.minutes.approvalStatus === "approved" && meeting.minutes.approvedBy && (
                    <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        Approved by {meeting.minutes.approvedBy} on {format(new Date(meeting.minutes.approvedAt!), "PPp")}. 
                        Minutes distributed to all attendees via email.
                      </span>
                    </div>
                  )}
                  
                  {meeting.minutes.approvalStatus === "rejected" && meeting.minutes.rejectionReason && (
                    <div className="bg-destructive/10 border border-destructive rounded-lg p-3">
                      <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                      <p className="text-sm text-foreground">{meeting.minutes.rejectionReason}</p>
                    </div>
                  )}

                  {meeting.minutes.processingStatus === "completed" && (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Summary</h4>
                        <p className="text-sm text-foreground">{meeting.minutes.summary}</p>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="text-sm font-semibold mb-3">Key Discussions</h4>
                        <ul className="space-y-2">
                          {meeting.minutes.keyDiscussions.map((discussion, index) => (
                            <li key={index} className="text-sm text-foreground flex gap-2">
                              <span className="text-muted-foreground">•</span>
                              <span>{discussion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="text-sm font-semibold mb-3">Decisions Made</h4>
                        <ul className="space-y-2">
                          {meeting.minutes.decisions.map((decision, index) => (
                            <li key={index} className="text-sm text-foreground flex gap-2">
                              <CheckCircle2 className="w-4 h-4 text-chart-2 flex-shrink-0 mt-0.5" />
                              <span>{decision}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No minutes available for this meeting yet.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="actions" className="px-6 pb-6">
              {meeting.actionItems && meeting.actionItems.length > 0 ? (
                <div className="space-y-3">
                  {meeting.actionItems.map((item) => (
                    <Card key={item.id} data-testid={`card-action-item-${item.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground mb-1">{item.task}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Assigned to: <span className="text-foreground">{item.assignee}</span></span>
                              {item.dueDate && (
                                <span>Due: <span className="text-foreground">{format(new Date(item.dueDate), "PP")}</span></span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "secondary"}>
                              {item.priority}
                            </Badge>
                            <Badge variant={item.status === "completed" ? "outline" : "secondary"}>
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No action items for this meeting.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="attachments" className="px-6 pb-6">
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No attachments available.</p>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Approve Confirmation Dialog */}
    <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve Meeting Minutes?</AlertDialogTitle>
          <AlertDialogDescription>
            This will approve the meeting minutes and automatically distribute them to all attendees via email 
            with DOCX and PDF attachments. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => meeting.minutes && approveMutation.mutate(meeting.minutes.id)}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? "Approving..." : "Approve & Distribute"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Reject Confirmation Dialog */}
    <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Meeting Minutes?</AlertDialogTitle>
          <AlertDialogDescription>
            Please provide a reason for rejecting these meeting minutes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
            data-testid="input-rejection-reason"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => meeting.minutes && rejectMutation.mutate({
              minutesId: meeting.minutes.id,
              reason: rejectionReason
            })}
            disabled={rejectMutation.isPending || !rejectionReason.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {rejectMutation.isPending ? "Rejecting..." : "Reject Minutes"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
