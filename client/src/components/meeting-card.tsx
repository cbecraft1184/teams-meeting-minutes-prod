import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, FileText, Download, Share2 } from "lucide-react";
import { ClassificationBadge } from "./classification-badge";
import { StatusBadge } from "./status-badge";
import { format } from "date-fns";
import type { MeetingWithMinutes } from "@shared/schema";

interface MeetingCardProps {
  meeting: MeetingWithMinutes;
  onViewDetails: (meeting: MeetingWithMinutes) => void;
}

export function MeetingCard({ meeting, onViewDetails }: MeetingCardProps) {
  return (
    <Card className="hover-elevate" data-testid={`card-meeting-${meeting.id}`}>
      <CardHeader className="space-y-0 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground mb-2 truncate">
              {meeting.title}
            </h3>
            {meeting.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {meeting.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={meeting.status} />
            <ClassificationBadge level={meeting.classificationLevel} size="sm" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{format(new Date(meeting.scheduledAt), "PPP")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{meeting.duration}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span>{meeting.attendees.length} attendees</span>
          </div>
          {meeting.minutes && (
            <div className="flex items-center gap-2 text-sm text-chart-2">
              <FileText className="w-4 h-4" />
              <span>Minutes available</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="default"
          size="sm"
          onClick={() => onViewDetails(meeting)}
          data-testid={`button-view-details-${meeting.id}`}
        >
          <FileText className="w-4 h-4 mr-2" />
          View Details
        </Button>
        <div className="flex items-center gap-2">
          {meeting.minutes?.docxUrl && (
            <Button
              variant="outline"
              size="sm"
              data-testid={`button-download-${meeting.id}`}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
          {meeting.status === "archived" && (
            <Button
              variant="outline"
              size="sm"
              data-testid={`button-share-${meeting.id}`}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
