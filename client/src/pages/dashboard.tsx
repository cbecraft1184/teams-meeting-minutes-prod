import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { StatsCard } from "@/components/stats-card";
import { MeetingCard } from "@/components/meeting-card";
import { MeetingDetailsModal } from "@/components/meeting-details-modal";
import { Button, SearchBox, makeStyles, tokens, shorthands } from "@fluentui/react-components";
import { Settings24Regular, Search24Regular } from "@fluentui/react-icons";
import { FileText, Calendar, Archive, CheckCircle2, AlertCircle } from "lucide-react";
import type { MeetingWithMinutes } from "@shared/schema";

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
});

export default function Dashboard() {
  const styles = useStyles();
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithMinutes | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: meetings, isLoading: meetingsLoading, isError: meetingsError, error: meetingsErrorDetails } = useQuery<MeetingWithMinutes[]>({
    queryKey: ["/api/meetings"],
  });

  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrorDetails } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const recentMeetings = meetings?.slice(0, 5) || [];
  const filteredMeetings = recentMeetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div style={{ flex: 1, maxWidth: "400px" }}>
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
          <div className={styles.meetingsGrid}>
            {filteredMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onViewDetails={setSelectedMeeting}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState} data-testid="empty-meetings">
            <Calendar style={{ width: "48px", height: "48px" }} className={styles.emptyIcon} />
            <p className={styles.errorSubtitle}>
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
