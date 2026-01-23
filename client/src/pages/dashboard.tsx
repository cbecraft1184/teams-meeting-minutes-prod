import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { StatsCard } from "@/components/stats-card";
import { MeetingCard } from "@/components/meeting-card";
import { MeetingDetailsModal } from "@/components/meeting-details-modal";
import { Button, SearchBox, makeStyles, tokens, shorthands, Switch, Badge, useToastController, Toast, ToastTitle, ToastBody, Spinner } from "@fluentui/react-components";
import { Settings24Regular, Search24Regular, ArrowSync24Regular } from "@fluentui/react-icons";
import { Pagination } from "@/components/Pagination";
import { FileText, Calendar, Archive, CheckCircle2, AlertCircle, EyeOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/authToken";
import { useTeams } from "@/contexts/TeamsContext";
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

type DashboardStats = {
  totalMeetings: number;
  pendingMinutes: number;
  completedMeetings: number;
  archivedMeetings: number;
  actionItems: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  };
};

const useStyles = makeStyles({
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap("16px"),
    flexWrap: "wrap",
  },
  title: {
    fontSize: "28px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "4px",
  },
  subtitle: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, 1fr)",
    ...shorthands.gap("16px"),
    "@media (min-width: 768px)": {
      gridTemplateColumns: "repeat(2, 1fr)",
    },
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "repeat(4, 1fr)",
    },
  },
  section: {
    marginTop: "24px",
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap("16px"),
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  skeleton: {
    height: "128px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    animationName: {
      from: { opacity: 0.5 },
      to: { opacity: 1 },
    },
    animationDuration: "1.5s",
    animationIterationCount: "infinite",
    animationDirection: "alternate",
  },
  errorState: {
    textAlign: "center",
    ...shorthands.padding("48px"),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  emptyState: {
    textAlign: "center",
    ...shorthands.padding("48px"),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  errorIcon: {
    marginLeft: "auto",
    marginRight: "auto",
    marginBottom: "12px",
    color: tokens.colorPaletteRedForeground1,
  },
  emptyIcon: {
    marginLeft: "auto",
    marginRight: "auto",
    marginBottom: "12px",
    color: tokens.colorNeutralForeground3,
  },
  errorTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "8px",
  },
  errorSubtitle: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
  },
  meetingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, 1fr)",
    ...shorthands.gap("16px"),
  },
  controlsRow: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("16px"),
    flexWrap: "wrap",
  },
  dismissedToggle: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
});

const PAGE_SIZE = 5;

export default function Dashboard() {
  const styles = useStyles();
  const { dispatchToast } = useToastController(APP_TOASTER_ID);
  const { isInitialized, hasToken, isInTeams } = useTeams();
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithMinutes | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showDismissed, setShowDismissed] = useState(false);
  
  const canFetch = isInitialized && (hasToken || !isInTeams);

  const offset = (currentPage - 1) * PAGE_SIZE;
  
  const { data: meetingsData, isLoading: meetingsLoading, isError: meetingsError, error: meetingsErrorDetails } = useQuery<MeetingsResponse>({
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
    enabled: canFetch,
  });

  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrorDetails } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
    enabled: canFetch,
  });

  // Dismiss mutation
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

  // Sync Now mutation
  const syncNowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/sync-now');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      const created = data?.calendar?.created || 0;
      const found = data?.callRecords?.processed || 0;
      dispatchToast(
        <Toast data-testid="toast-sync-complete">
          <ToastTitle>Sync Complete</ToastTitle>
          <ToastBody>{created + found > 0 ? `Found ${created + found} new meeting(s)` : 'No new meetings found'}</ToastBody>
        </Toast>,
        { intent: "success" }
      );
    },
    onError: () => {
      dispatchToast(
        <Toast data-testid="toast-sync-error">
          <ToastTitle>Sync Failed</ToastTitle>
          <ToastBody>Could not sync meetings from Teams</ToastBody>
        </Toast>,
        { intent: "error" }
      );
    },
  });

  // Restore mutation
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

  // Client-side search filtering
  const filteredMeetings = meetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title} data-testid="heading-dashboard">
            Meeting Minutes Dashboard
          </h1>
          <p className={styles.subtitle}>
            Meetings are automatically captured from Microsoft Teams
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Button 
            appearance="primary" 
            icon={syncNowMutation.isPending ? <Spinner size="tiny" /> : <ArrowSync24Regular />}
            onClick={() => syncNowMutation.mutate()}
            disabled={syncNowMutation.isPending}
            data-testid="button-sync-now"
          >
            {syncNowMutation.isPending ? "Syncing..." : "Sync Now"}
          </Button>
          <Link href="/settings">
            <Button 
              appearance="subtle" 
              icon={<Settings24Regular />}
              data-testid="button-settings"
            >
              Teams Integration
            </Button>
          </Link>
        </div>
      </div>

      <div className={styles.statsGrid}>
        {statsLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </>
        ) : statsError ? (
          <div className={styles.errorState} style={{ gridColumn: "1 / -1" }}>
            <p className={styles.errorSubtitle}>Failed to load statistics</p>
            <pre style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              {statsErrorDetails?.message || 'Unknown error'}
            </pre>
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

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Meetings</h2>
          <div className={styles.controlsRow}>
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
            <div style={{ flex: 1, maxWidth: "300px" }}>
              <SearchBox
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(_, data) => setSearchQuery(data.value)}
                data-testid="input-search-meetings"
                contentBefore={<Search24Regular />}
                dismiss={searchQuery ? {
                  'aria-label': 'Clear search',
                  onClick: () => setSearchQuery('')
                } : undefined}
              />
            </div>
          </div>
        </div>

        {meetingsLoading ? (
          <div className={styles.meetingsGrid} data-testid="loading-meetings">
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeleton} style={{ height: "192px" }} />
            ))}
          </div>
        ) : meetingsError ? (
          <div className={styles.errorState} data-testid="error-meetings">
            <AlertCircle style={{ width: "48px", height: "48px" }} className={styles.errorIcon} />
            <p className={styles.errorTitle}>Failed to load meetings</p>
            <p className={styles.errorSubtitle}>Please try refreshing the page.</p>
            <pre style={{ 
              marginTop: '16px', 
              padding: '12px', 
              backgroundColor: '#fff', 
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '11px',
              textAlign: 'left',
              overflow: 'auto',
              maxHeight: '150px'
            }}>
              {meetingsErrorDetails?.message || 'Unknown error'}
            </pre>
          </div>
        ) : filteredMeetings.length > 0 ? (
          <>
            <div className={styles.meetingsGrid}>
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
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={handlePageChange} 
            />
          </>
        ) : (
          <div className={styles.emptyState} data-testid="empty-meetings">
            <Calendar style={{ width: "48px", height: "48px" }} className={styles.emptyIcon} />
            <p className={styles.errorSubtitle}>
              {searchQuery 
                ? "No meetings found matching your search." 
                : showDismissed 
                  ? "No hidden meetings to display." 
                  : "No recent meetings to display."}
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
