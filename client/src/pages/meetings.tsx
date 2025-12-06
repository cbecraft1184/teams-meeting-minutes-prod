import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { MeetingCard } from "@/components/meeting-card";
import { MeetingDetailsModal } from "@/components/meeting-details-modal";
import { 
  Input, 
  Dropdown, 
  Option, 
  Spinner,
  Button,
  Switch,
  Badge,
  makeStyles, 
  tokens, 
  shorthands,
  useToastController,
  Toast,
  ToastTitle,
  ToastBody
} from "@fluentui/react-components";
import { 
  Search20Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular
} from "@fluentui/react-icons";
import { Calendar, AlertCircle, EyeOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/authToken";
import { APP_TOASTER_ID } from "@/App";
import type { MeetingWithMinutes } from "@shared/schema";

interface MeetingWithDismissed extends MeetingWithMinutes {
  isDismissed?: boolean;
}

interface MeetingsResponse {
  meetings: MeetingWithDismissed[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  dismissedCount: number;
}

const PAGE_SIZE = 5;

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
  paginationRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.gap("8px"),
    marginTop: "16px",
  },
  pageButton: {
    minWidth: "32px",
  },
  pageInfo: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    ...shorthands.padding("0", "8px"),
  },
  dismissedToggle: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
});

export default function Meetings() {
  const styles = useStyles();
  const qc = useQueryClient();
  const { dispatchToast } = useToastController(APP_TOASTER_ID);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithMinutes | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDismissed, setShowDismissed] = useState(false);

  const offset = (currentPage - 1) * PAGE_SIZE;

  const { data: meetingsData, isLoading, isError } = useQuery<MeetingsResponse>({
    queryKey: ["/api/meetings", { limit: PAGE_SIZE, offset, includeDismissed: showDismissed }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: offset.toString(),
        includeDismissed: showDismissed.toString(),
      });
      const token = getAuthToken();
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/meetings?${params}`, { 
        headers,
        credentials: 'include' 
      });
      if (!res.ok) throw new Error('Failed to fetch meetings');
      return res.json();
    },
  });

  useEffect(() => {
    const syncCalendar = async () => {
      try {
        setIsSyncing(true);
        await apiRequest("POST", "/api/calendar/sync");
        qc.invalidateQueries({ queryKey: ["/api/meetings"] });
        qc.invalidateQueries({ queryKey: ["/api/stats"] });
      } catch (error) {
        console.log("[CalendarSync] Auto-sync completed or skipped");
      } finally {
        setIsSyncing(false);
      }
    };

    syncCalendar();
  }, [qc]);

  const dismissMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      return apiRequest('POST', `/api/meetings/${meetingId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      dispatchToast(
        <Toast data-testid="toast-meeting-hidden">
          <ToastTitle>Meeting hidden</ToastTitle>
          <ToastBody>You can restore it using "Show hidden"</ToastBody>
        </Toast>,
        { intent: "success" }
      );
    },
    onError: () => {
      dispatchToast(
        <Toast data-testid="toast-hide-error">
          <ToastTitle>Error</ToastTitle>
          <ToastBody>Failed to hide meeting</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      return apiRequest('POST', `/api/meetings/${meetingId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      dispatchToast(
        <Toast data-testid="toast-meeting-restored">
          <ToastTitle>Meeting restored</ToastTitle>
          <ToastBody>The meeting is now visible in your list</ToastBody>
        </Toast>,
        { intent: "success" }
      );
    },
    onError: () => {
      dispatchToast(
        <Toast data-testid="toast-restore-error">
          <ToastTitle>Error</ToastTitle>
          <ToastBody>Failed to restore meeting</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    },
  });

  const meetings = meetingsData?.meetings || [];
  const pagination = meetingsData?.pagination;
  const dismissedCount = meetingsData?.dismissedCount || 0;
  const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 1;

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         meeting.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;
    const matchesClassification = classificationFilter === "all" || 
                                  meeting.classificationLevel === classificationFilter;
    
    return matchesSearch && matchesStatus && matchesClassification;
  });

  const handleDismiss = (meetingId: string) => {
    dismissMutation.mutate(meetingId);
  };

  const handleRestore = (meetingId: string) => {
    restoreMutation.mutate(meetingId);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title} data-testid="heading-my-meetings">
            My Meetings
          </h1>
          <p className={styles.subtitle}>
            {isSyncing ? "Syncing with Teams calendar..." : "Meetings you've organized or been invited to"}
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
          data-testid="input-search-meetings"
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

        <div className={styles.dismissedToggle}>
          <Switch
            checked={showDismissed}
            onChange={(_, data) => {
              setShowDismissed(data.checked);
              setCurrentPage(1);
            }}
            data-testid="switch-show-dismissed"
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <EyeOff size={14} />
                Show hidden
                {dismissedCount > 0 && (
                  <Badge appearance="filled" size="small" color="informative">
                    {dismissedCount}
                  </Badge>
                )}
              </span>
            }
          />
        </div>
      </div>

      <div className={styles.resultsCount}>
        Showing {filteredMeetings.length} of {pagination?.total || 0} meetings
        {currentPage > 1 && ` (Page ${currentPage})`}
      </div>

      {isLoading ? (
        <div className={styles.gridContainer} data-testid="loading-all-meetings">
          {[1, 2, 3, 4, 5].map((i) => (
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
        <>
          <div className={styles.gridContainer}>
            {filteredMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onViewDetails={setSelectedMeeting}
                onDismiss={handleDismiss}
                onRestore={handleRestore}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className={styles.paginationRow}>
              <Button
                appearance="subtle"
                icon={<ChevronLeft24Regular />}
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                data-testid="button-prev-page"
                className={styles.pageButton}
              />
              <span className={styles.pageInfo} data-testid="text-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                appearance="subtle"
                icon={<ChevronRight24Regular />}
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                data-testid="button-next-page"
                className={styles.pageButton}
              />
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState} data-testid="empty-all-meetings">
          <Calendar className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No meetings found</p>
          <p className={styles.emptyDescription}>
            {searchQuery || statusFilter !== "all" || classificationFilter !== "all"
              ? "Try adjusting your filters or search query."
              : showDismissed 
                ? "No hidden meetings to display."
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
