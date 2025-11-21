import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MeetingCard } from "@/components/meeting-card";
import { MeetingDetailsModal } from "@/components/meeting-details-modal";
import { 
  Input, 
  Label, 
  Card, 
  Dropdown, 
  Option, 
  Button,
  makeStyles, 
  tokens, 
  shorthands 
} from "@fluentui/react-components";
import { DatePicker } from "@fluentui/react-datepicker-compat";
import { 
  Search20Regular, 
  Dismiss20Regular 
} from "@fluentui/react-icons";
import { Archive, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { MeetingWithMinutes } from "@shared/schema";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXL),
  },
  header: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  title: {
    fontSize: "28px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    ...shorthands.margin(0),
  },
  subtitle: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    ...shorthands.margin(0),
  },
  cardContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
  },
  gridRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    ...shorthands.gap("16px"),
    "@media (min-width: 768px)": {
      gridTemplateColumns: "1fr 1fr",
    },
  },
  gridRowFull: {
    display: "grid",
    gridTemplateColumns: "1fr",
    ...shorthands.gap("16px"),
  },
  formField: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  clearButtonContainer: {
    display: "flex",
    justifyContent: "flex-end",
  },
  resultsCount: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "1fr",
    ...shorthands.gap("16px"),
  },
  loadingCard: {
    height: "192px",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    animationName: {
      "0%": { opacity: "1" },
      "50%": { opacity: "0.5" },
      "100%": { opacity: "1" },
    },
    animationDuration: "2s",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  },
  emptyState: {
    textAlign: "center",
    ...shorthands.padding("64px", "16px"),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
  },
  emptyIcon: {
    width: "64px",
    height: "64px",
    color: tokens.colorNeutralForeground3,
    marginLeft: "auto",
    marginRight: "auto",
    marginBottom: "16px",
  },
  emptyIconError: {
    width: "64px",
    height: "64px",
    color: tokens.colorPaletteRedForeground1,
    marginLeft: "auto",
    marginRight: "auto",
    marginBottom: "16px",
  },
  emptyTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "8px",
  },
  emptyDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
  },
  labelText: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
});

export default function Search() {
  const styles = useStyles();
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title} data-testid="heading-search-archive">
          Search Archive
        </h1>
        <p className={styles.subtitle}>
          Search through archived meeting minutes and documentation
        </p>
      </div>

      <Card>
        <div className={styles.cardContent}>
          <div className={styles.gridRowFull}>
            <div className={styles.formField}>
              <Label className={styles.labelText}>Search</Label>
              <Input
                placeholder="Search by title, description, or attendee..."
                value={searchQuery}
                onChange={(e, data) => setSearchQuery(data.value)}
                contentBefore={<Search20Regular />}
                data-testid="input-search-archive"
              />
            </div>
          </div>

          <div className={styles.gridRow}>
            <div className={styles.formField}>
              <Label className={styles.labelText}>Date From</Label>
              <DatePicker
                placeholder="Select date"
                value={dateFrom}
                onSelectDate={(date: Date | null | undefined) => setDateFrom(date || undefined)}
                formatDate={(date: Date | null | undefined) => date ? format(date, "PPP") : ""}
                data-testid="button-date-from"
              />
            </div>

            <div className={styles.formField}>
              <Label className={styles.labelText}>Date To</Label>
              <DatePicker
                placeholder="Select date"
                value={dateTo}
                onSelectDate={(date: Date | null | undefined) => setDateTo(date || undefined)}
                formatDate={(date: Date | null | undefined) => date ? format(date, "PPP") : ""}
                data-testid="button-date-to"
              />
            </div>
          </div>

          <div className={styles.gridRow}>
            <div className={styles.formField}>
              <Label className={styles.labelText}>Status</Label>
              <Dropdown
                placeholder="All Statuses"
                selectedOptions={[statusFilter]}
                onOptionSelect={(_, data) => setStatusFilter(data.optionValue as string)}
                data-testid="select-search-status"
              >
                <Option value="all">All Statuses</Option>
                <Option value="scheduled">Scheduled</Option>
                <Option value="in_progress">In Progress</Option>
                <Option value="completed">Completed</Option>
                <Option value="archived">Archived</Option>
              </Dropdown>
            </div>

            <div className={styles.formField}>
              <Label className={styles.labelText}>Classification Level</Label>
              <Dropdown
                placeholder="All Classifications"
                selectedOptions={[classificationFilter]}
                onOptionSelect={(_, data) => setClassificationFilter(data.optionValue as string)}
                data-testid="select-search-classification"
              >
                <Option value="all">All Classifications</Option>
                <Option value="UNCLASSIFIED">Unclassified</Option>
                <Option value="CONFIDENTIAL">Confidential</Option>
                <Option value="SECRET">Secret</Option>
              </Dropdown>
            </div>
          </div>

          {hasActiveFilters && (
            <div className={styles.clearButtonContainer}>
              <Button 
                appearance="outline" 
                size="small" 
                onClick={clearFilters} 
                icon={<Dismiss20Regular />}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className={styles.resultsCount}>
        {filteredMeetings.length} {filteredMeetings.length === 1 ? "result" : "results"} found
      </div>

      {isLoading ? (
        <div className={styles.gridContainer} data-testid="loading-search-results">
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.loadingCard} />
          ))}
        </div>
      ) : isError ? (
        <div className={styles.emptyState} data-testid="error-search-results">
          <AlertCircle className={styles.emptyIconError} />
          <p className={styles.emptyTitle}>Failed to load meetings</p>
          <p className={styles.emptyDescription}>Please try refreshing the page.</p>
        </div>
      ) : filteredMeetings.length > 0 ? (
        <div className={styles.gridContainer}>
          {filteredMeetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onViewDetails={setSelectedMeeting}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState} data-testid="empty-search-results">
          <Archive className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No results found</p>
          <p className={styles.emptyDescription}>
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
