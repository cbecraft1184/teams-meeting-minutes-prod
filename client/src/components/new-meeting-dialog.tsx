import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClassificationBadge } from "./classification-badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  FileText,
  Users,
  Clock,
  Shield,
  Briefcase,
  Calendar as CalendarIcon,
  AlertTriangle,
  ClipboardList
} from "lucide-react";
import type { MeetingTemplate } from "@shared/schema";

interface NewMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATE_ICONS: Record<string, any> = {
  briefing: Briefcase,
  planning: ClipboardList,
  status_review: FileText,
  emergency_response: AlertTriangle
};

export function NewMeetingDialog({ open, onOpenChange }: NewMeetingDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MeetingTemplate | null>(null);
  const [step, setStep] = useState<"select" | "configure">("select");
  const [formData, setFormData] = useState({
    title: "",
    scheduledAt: "",
    attendees: ""
  });
  const { toast } = useToast();

  const { data: templates, isLoading } = useQuery<MeetingTemplate[]>({
    queryKey: ["/api/templates/system"],
    enabled: open
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: { templateId: string; scheduledAt: string; attendees: string[]; title?: string }) => {
      return await apiRequest(`/api/templates/${data.templateId}/create-meeting`, {
        method: "POST",
        body: JSON.stringify({
          scheduledAt: data.scheduledAt,
          attendees: data.attendees,
          title: data.title
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Meeting captured",
        description: "Teams meeting has been registered for processing. Upload the recording or transcript to generate minutes."
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create meeting",
        variant: "destructive"
      });
    }
  });

  const handleClose = () => {
    setStep("select");
    setSelectedTemplate(null);
    setFormData({ title: "", scheduledAt: "", attendees: "" });
    onOpenChange(false);
  };

  const handleSelectTemplate = (template: MeetingTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      title: template.name,
      scheduledAt: "",
      attendees: template.suggestedAttendees?.join(", ") || ""
    });
    setStep("configure");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    const attendeesList = formData.attendees
      .split(",")
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (attendeesList.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one attendee",
        variant: "destructive"
      });
      return;
    }

    createMeetingMutation.mutate({
      templateId: selectedTemplate.id,
      scheduledAt: formData.scheduledAt,
      attendees: attendeesList,
      title: formData.title || selectedTemplate.name
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]" data-testid="dialog-new-meeting">
        <DialogHeader>
          <DialogTitle>
            {step === "select" ? "Capture Meeting from Microsoft Teams" : "Enter Teams Meeting Details"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" 
              ? "Select the type of Teams meeting to capture for processing" 
              : "Enter details from the Teams meeting that has already occurred"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <ScrollArea className="h-[500px] pr-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 bg-card rounded-lg border border-card-border animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates?.map((template) => {
                  const Icon = TEMPLATE_ICONS[template.type] || FileText;
                  return (
                    <Card 
                      key={template.id} 
                      className="cursor-pointer hover-elevate active-elevate-2 transition-all"
                      onClick={() => handleSelectTemplate(template)}
                      data-testid={`card-template-${template.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Icon className="w-5 h-5 text-primary" />
                              <h4 className="font-semibold text-foreground">{template.name}</h4>
                            </div>
                            <ClassificationBadge level={template.defaultClassification} />
                          </div>
                          
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {template.defaultDuration}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {template.suggestedAttendees?.length || 0} attendees
                            </div>
                          </div>

                          {template.agendaItems && template.agendaItems.length > 0 && (
                            <div className="pt-2 border-t border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Agenda:</p>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {template.agendaItems.slice(0, 3).map((item, idx) => (
                                  <li key={idx} className="truncate">• {item}</li>
                                ))}
                                {template.agendaItems.length > 3 && (
                                  <li className="text-primary">+ {template.agendaItems.length - 3} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}

        {step === "configure" && selectedTemplate && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
              <p className="text-sm text-foreground">
                <strong>Note:</strong> This captures a meeting that was already held in Microsoft Teams. 
                Enter the details from your Teams meeting below.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Teams Meeting Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter the title from Teams"
                data-testid="input-meeting-title"
              />
              <p className="text-xs text-muted-foreground">
                Copy the meeting title from Microsoft Teams
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Meeting Date & Time (when it occurred in Teams)</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                required
                data-testid="input-meeting-datetime"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendees">Attendees (from Teams meeting)</Label>
              <Textarea
                id="attendees"
                value={formData.attendees}
                onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                placeholder="john.doe@dod.gov, jane.smith@dod.gov"
                rows={3}
                required
                data-testid="input-meeting-attendees"
              />
              <p className="text-xs text-muted-foreground">
                Enter email addresses of Teams meeting participants (comma-separated)
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setStep("select")}
                data-testid="button-back"
              >
                Back to Templates
              </Button>
              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={handleClose}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMeetingMutation.isPending}
                  data-testid="button-create-meeting"
                >
                  {createMeetingMutation.isPending ? "Creating..." : "Create Meeting"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
