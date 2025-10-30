import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MeetingCard } from "@/components/meeting-card";
import { MeetingDetailsModal } from "@/components/meeting-details-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Search, Filter, SlidersHorizontal, AlertCircle } from "lucide-react";
import type { MeetingWithMinutes } from "@shared/schema";

export default function Meetings() {
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithMinutes | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");

  const { data: meetings, isLoading, isError } = useQuery<MeetingWithMinutes[]>({
    queryKey: ["/api/meetings"],
  });

  const filteredMeetings = (meetings || []).filter((meeting) => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         meeting.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;
    const matchesClassification = classificationFilter === "all" || 
                                  meeting.classificationLevel === classificationFilter;
    return matchesSearch && matchesStatus && matchesClassification;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground" data-testid="heading-all-meetings">
            All Meetings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and manage all meeting records
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search meetings, attendees, or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-all-meetings"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={classificationFilter} onValueChange={setClassificationFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-classification-filter">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classifications</SelectItem>
            <SelectItem value="UNCLASSIFIED">Unclassified</SelectItem>
            <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
            <SelectItem value="SECRET">Secret</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredMeetings.length} of {meetings?.length || 0} meetings
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4" data-testid="loading-all-meetings">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-card rounded-lg border border-card-border animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-card rounded-lg border border-card-border" data-testid="error-all-meetings">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <p className="text-base font-medium text-foreground mb-2">Failed to load meetings</p>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      ) : filteredMeetings.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredMeetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onViewDetails={setSelectedMeeting}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-lg border border-card-border" data-testid="empty-all-meetings">
          <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-base font-medium text-foreground mb-2">No meetings found</p>
          <p className="text-sm text-muted-foreground">
            {searchQuery || statusFilter !== "all" || classificationFilter !== "all"
              ? "Try adjusting your filters or search query."
              : "No meetings have been recorded yet."}
          </p>
        </div>
      )}

      <MeetingDetailsModal
        meeting={selectedMeeting}
        open={!!selectedMeeting}
        onOpenChange={(open) => !open && setSelectedMeeting(null)}
      />
    </div>
  );
}
