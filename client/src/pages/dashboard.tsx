import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { MeetingCard } from "@/components/meeting-card";
import { MeetingDetailsModal } from "@/components/meeting-details-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, Archive, CheckCircle2, Plus, Search, AlertCircle } from "lucide-react";
import type { MeetingWithMinutes } from "@shared/schema";

export default function Dashboard() {
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithMinutes | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: meetings, isLoading: meetingsLoading, isError: meetingsError } = useQuery<MeetingWithMinutes[]>({
    queryKey: ["/api/meetings"],
  });

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ["/api/stats"],
  });

  const recentMeetings = meetings?.slice(0, 5) || [];
  const filteredMeetings = recentMeetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground" data-testid="heading-dashboard">
            Meeting Minutes Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and archive DOD Teams meeting documentation
          </p>
        </div>
        <Button data-testid="button-new-meeting">
          <Plus className="w-4 h-4 mr-2" />
          New Meeting
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-card rounded-lg border border-card-border animate-pulse" />
            ))}
          </>
        ) : statsError ? (
          <div className="col-span-full text-center py-8 bg-card rounded-lg border border-card-border">
            <p className="text-sm text-muted-foreground">Failed to load statistics</p>
          </div>
        ) : (
          <>
            <StatsCard
              title="Total Meetings"
              value={stats?.totalMeetings || 0}
              icon={Calendar}
              description="All recorded meetings"
            />
            <StatsCard
              title="Pending Minutes"
              value={stats?.pendingMinutes || 0}
              icon={FileText}
              description="Awaiting generation"
            />
            <StatsCard
              title="Completed"
              value={stats?.completedMeetings || 0}
              icon={CheckCircle2}
              description="Fully processed"
            />
            <StatsCard
              title="Archived"
              value={stats?.archivedMeetings || 0}
              icon={Archive}
              description="In SharePoint"
            />
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-semibold text-foreground">Recent Meetings</h2>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-meetings"
            />
          </div>
        </div>

        {meetingsLoading ? (
          <div className="grid grid-cols-1 gap-4" data-testid="loading-meetings">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-card rounded-lg border border-card-border animate-pulse" />
            ))}
          </div>
        ) : meetingsError ? (
          <div className="text-center py-12 bg-card rounded-lg border border-card-border" data-testid="error-meetings">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
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
          <div className="text-center py-12 bg-card rounded-lg border border-card-border" data-testid="empty-meetings">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No meetings found matching your search." : "No recent meetings to display."}
            </p>
          </div>
        )}
      </div>

      <MeetingDetailsModal
        meeting={selectedMeeting}
        open={!!selectedMeeting}
        onOpenChange={(open) => !open && setSelectedMeeting(null)}
      />
    </div>
  );
}
