import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MeetingCard } from "@/components/meeting-card";
import { MeetingDetailsModal } from "@/components/meeting-details-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search as SearchIcon, Calendar as CalendarIcon, Archive, X, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { MeetingWithMinutes } from "@shared/schema";

export default function Search() {
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithMinutes | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");

  const { data: meetings, isLoading, isError } = useQuery<MeetingWithMinutes[]>({
    queryKey: ["/api/meetings"],
  });

  const filteredMeetings = (meetings || []).filter((meeting) => {
    const matchesSearch = searchQuery === "" || 
      meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.attendees.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;
    const matchesClassification = classificationFilter === "all" || 
                                  meeting.classificationLevel === classificationFilter;
    
    const meetingDate = new Date(meeting.scheduledAt);
    const matchesDateFrom = !dateFrom || meetingDate >= dateFrom;
    const matchesDateTo = !dateTo || meetingDate <= dateTo;

    return matchesSearch && matchesStatus && matchesClassification && matchesDateFrom && matchesDateTo;
  });

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatusFilter("all");
    setClassificationFilter("all");
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo || statusFilter !== "all" || classificationFilter !== "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="heading-search-archive">
          Search Archive
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search through archived meeting minutes and documentation
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="search-input">Search</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search-input"
                  placeholder="Search by title, description, or attendee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-archive"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-date-from"
                  >
                    <CalendarIcon className="mr-2 w-4 h-4" />
                    {dateFrom ? format(dateFrom, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-date-to"
                  >
                    <CalendarIcon className="mr-2 w-4 h-4" />
                    {dateTo ? format(dateTo, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-search-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Classification Level</Label>
              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger data-testid="select-search-classification">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classifications</SelectItem>
                  <SelectItem value="UNCLASSIFIED">Unclassified</SelectItem>
                  <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
                  <SelectItem value="SECRET">Secret</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {filteredMeetings.length} {filteredMeetings.length === 1 ? "result" : "results"} found
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4" data-testid="loading-search-results">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-card rounded-lg border border-card-border animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-card rounded-lg border border-card-border" data-testid="error-search-results">
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
        <div className="text-center py-16 bg-card rounded-lg border border-card-border" data-testid="empty-search-results">
          <Archive className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-base font-medium text-foreground mb-2">No results found</p>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Try adjusting your search criteria or filters."
              : "Use the search filters above to find specific meetings."}
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
