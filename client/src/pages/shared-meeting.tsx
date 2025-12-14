import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, makeStyles, tokens, shorthands, Spinner, Button } from "@fluentui/react-components";
import { Calendar, Clock, Users, FileText, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ClassificationBadge } from "@/components/classification-badge";
import { StatusBadge } from "@/components/status-badge";
import type { MeetingWithMinutes } from "@shared/schema";

const useStyles = makeStyles({
  container: {
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "300px",
    ...shorthands.gap("16px"),
  },
  errorCard: {
    ...shorthands.padding("32px"),
    textAlign: "center",
  },
  errorIcon: {
    color: tokens.colorPaletteRedForeground1,
    marginBottom: "16px",
  },
  errorTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "8px",
  },
  errorMessage: {
    color: tokens.colorNeutralForeground3,
    marginBottom: "24px",
  },
  sharedByNotice: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
    ...shorthands.padding("12px", "16px"),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("8px"),
    marginBottom: "24px",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  meetingCard: {
    ...shorthands.padding("24px"),
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    ...shorthands.gap("16px"),
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  title: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "8px",
  },
  description: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
  },
  badges: {
    display: "flex",
    ...shorthands.gap("8px"),
  },
  metadataGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    ...shorthands.gap("16px"),
    marginBottom: "24px",
  },
  metadataItem: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  metadataIcon: {
    color: tokens.colorNeutralForeground3,
  },
  section: {
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "12px",
  },
  minutesContent: {
    color: tokens.colorNeutralForeground2,
    lineHeight: "1.6",
    whiteSpace: "pre-wrap",
  },
  list: {
    marginLeft: "20px",
    color: tokens.colorNeutralForeground2,
    lineHeight: "1.8",
  },
});

interface SharedMeetingResponse {
  meeting: MeetingWithMinutes;
  sharedBy: {
    email: string;
    name: string | null;
  };
}

export default function SharedMeeting() {
  const styles = useStyles();
  const [, params] = useRoute("/share/:token");
  const token = params?.token;

  const { data, isLoading, error } = useQuery<SharedMeetingResponse>({
    queryKey: ["/api/share", token],
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spinner size="large" />
          <span>Loading shared meeting...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const errorMessage = (error as any)?.message || "Unable to access this shared meeting";
    return (
      <div className={styles.container}>
        <Card className={styles.errorCard}>
          <AlertCircle size={48} className={styles.errorIcon} />
          <h2 className={styles.errorTitle}>Unable to Access Meeting</h2>
          <p className={styles.errorMessage}>{errorMessage}</p>
          <Button appearance="primary" onClick={() => window.location.href = "/"}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const { meeting, sharedBy } = data;

  return (
    <div className={styles.container}>
      <div className={styles.sharedByNotice}>
        <FileText size={16} />
        <span>
          Shared by {sharedBy.name || sharedBy.email} - This link is only accessible to members of your organization.
        </span>
      </div>

      <Card className={styles.meetingCard}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{meeting.title}</h1>
            {meeting.description && (
              <p className={styles.description}>{meeting.description}</p>
            )}
          </div>
          <div className={styles.badges}>
            <StatusBadge status={meeting.status} />
            <ClassificationBadge level={meeting.classificationLevel} size="sm" />
          </div>
        </div>

        <div className={styles.metadataGrid}>
          <div className={styles.metadataItem}>
            <Calendar className={styles.metadataIcon} size={16} />
            <span>{format(new Date(meeting.scheduledAt), "PPP")}</span>
          </div>
          <div className={styles.metadataItem}>
            <Clock className={styles.metadataIcon} size={16} />
            <span>{meeting.duration}</span>
          </div>
          <div className={styles.metadataItem}>
            <Users className={styles.metadataIcon} size={16} />
            <span>{meeting.attendees.length} attendees</span>
          </div>
        </div>

        {meeting.minutes && (
          <>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Summary</h3>
              <p className={styles.minutesContent}>{meeting.minutes.summary}</p>
            </div>

            {meeting.minutes.keyDiscussions && meeting.minutes.keyDiscussions.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Key Discussions</h3>
                <ul className={styles.list}>
                  {meeting.minutes.keyDiscussions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {meeting.minutes.decisions && meeting.minutes.decisions.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Decisions</h3>
                <ul className={styles.list}>
                  {meeting.minutes.decisions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {meeting.actionItems && meeting.actionItems.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Action Items</h3>
                <ul className={styles.list}>
                  {meeting.actionItems.map((item) => (
                    <li key={item.id}>
                      <strong>{item.assignee}</strong>: {item.task}
                      {item.dueDate && ` (Due: ${format(new Date(item.dueDate), "PP")})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
