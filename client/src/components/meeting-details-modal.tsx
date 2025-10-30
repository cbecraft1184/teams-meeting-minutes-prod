import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  Download, 
  ExternalLink,
  CheckCircle2,
  User
} from "lucide-react";
import { format } from "date-fns";
import { ClassificationBadge } from "./classification-badge";
import { StatusBadge } from "./status-badge";
import { ProcessingStatus } from "./processing-status";
import type { MeetingWithMinutes } from "@shared/schema";

interface MeetingDetailsModalProps {
  meeting: MeetingWithMinutes | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeetingDetailsModal({ meeting, open, onOpenChange }: MeetingDetailsModalProps) {
  if (!meeting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0" data-testid="modal-meeting-details">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl font-semibold mb-2">
                {meeting.title}
              </DialogTitle>
              {meeting.description && (
                <p className="text-sm text-muted-foreground">{meeting.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={meeting.status} />
              <ClassificationBadge level={meeting.classificationLevel} />
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <Tabs defaultValue="overview" className="flex-1">
          <div className="px-6">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="minutes" data-testid="tab-minutes">Minutes</TabsTrigger>
              <TabsTrigger value="actions" data-testid="tab-actions">Action Items</TabsTrigger>
              <TabsTrigger value="attachments" data-testid="tab-attachments">Attachments</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[500px]">
            <TabsContent value="overview" className="px-6 pb-6 space-y-6">
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
                    <ProcessingStatus status={meeting.minutes.processingStatus} />
                    <div className="flex items-center gap-2">
                      {meeting.minutes.docxUrl && (
                        <Button variant="outline" size="sm" data-testid="button-download-docx">
                          <Download className="w-4 h-4 mr-2" />
                          Download DOCX
                        </Button>
                      )}
                      {meeting.minutes.pdfUrl && (
                        <Button variant="outline" size="sm" data-testid="button-download-pdf">
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                      )}
                    </div>
                  </div>

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
  );
}
