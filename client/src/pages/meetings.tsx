import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MeetingCard } from "@/components/meeting-card";
import { MeetingDetailsModal } from "@/components/meeting-details-modal";
import { 
  Input, 
  Dropdown, 
  Option, 
  Spinner,
  makeStyles, 
  tokens, 
  shorthands 
} from "@fluentui/react-components";
import { 
  Search20Regular
} from "@fluentui/react-icons";
import { Calendar, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { MeetingWithMinutes } from "@shared/schema";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXL),
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap("16px"),
    flexWrap: "wrap",
  },
  headerContent: {
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
  filterRow: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("16px"),
    flexWrap: "wrap",
  },
  searchInput: {
    flex: 1,
    minWidth: "240px",
  },
  filterDropdown: {
    width: "180px",
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
});

export default function Meetings() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithMinutes | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: meetings, isLoading, isError } = useQuery<MeetingWithMinutes[]>({
    queryKey: ["/api/meetings"],
  });

  useEffect(() => {
    const syncCalendar = async () => {
      try {
        setIsSyncing(true);
        await apiRequest("POST", "/api/calendar/sync");
        queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      } catch (error) {
        console.log("[CalendarSync] Auto-sync completed or skipped");
      } finally {
        setIsSyncing(false);
      }
    };

    syncCalendar();
  }, [queryClient]);

  const filteredMeetings = (meetings || []).filter((meeting) => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         meeting.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;
    const matchesClassification = classificationFilter === "all" || 
                                  meeting.classificationLevel === classificationFilter;
    return matchesSearch && matchesStatus && matchesClassification;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title} data-testid="heading-all-meetings">
            All Meetings
          </h1>
          <p className={styles.subtitle}>
            {isSyncing ? "Syncing with Teams calendar..." : "Meetings synced from your Teams calendar"}
          </p>
        </div>
        {isSyncing && <Spinner size="small" label="Syncing..." />}
      </div>

      <div className={styles.filterRow}>
        <Input
          className={styles.searchInput}
          placeholder="Search meetings, attendees, or topics..."
          value={searchQuery}
          onChange={(e, data) => setSearchQuery(data.value)}
          contentBefore={<Search20Regular />}
          data-testid="input-search-all-meetings"
        />

        <Dropdown
          className={styles.filterDropdown}
          placeholder="Status"
          selectedOptions={[statusFilter]}
          onOptionSelect={(_, data) => setStatusFilter(data.optionValue as string)}
          data-testid="select-status-filter"
        >
          <Option value="all">All Statuses</Option>
          <Option value="scheduled">Scheduled</Option>
          <Option value="in_progress">In Progress</Option>
          <Option value="completed">Completed</Option>
          <Option value="archived">Archived</Option>
        </Dropdown>

        <Dropdown
          className={styles.filterDropdown}
          placeholder="Classification"
          selectedOptions={[classificationFilter]}
          onOptionSelect={(_, data) => setClassificationFilter(data.optionValue as string)}
          data-testid="select-classification-filter"
        >
          <Option value="all">All Classifications</Option>
          <Option value="UNCLASSIFIED">Unclassified</Option>
          <Option value="CONFIDENTIAL">Confidential</Option>
          <Option value="SECRET">Secret</Option>
        </Dropdown>
      </div>

      <div className={styles.resultsCount}>
        Showing {filteredMeetings.length} of {meetings?.length || 0} meetings
      </div>

      {isLoading ? (
        <div className={styles.gridContainer} data-testid="loading-all-meetings">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.loadingCard} />
          ))}
        </div>
      ) : isError ? (
        <div className={styles.emptyState} data-testid="error-all-meetings">
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
        <div className={styles.emptyState} data-testid="empty-all-meetings">
          <Calendar className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No meetings found</p>
          <p className={styles.emptyDescription}>
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
