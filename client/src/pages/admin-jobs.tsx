import { 
  Card, 
  CardHeader,
  Text,
  Button, 
  Badge, 
  makeStyles, 
  tokens, 
  shorthands,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tooltip,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent
} from "@fluentui/react-components";
import { 
  ArrowSync20Regular,
  Clock20Regular,
  Warning20Regular,
  Checkmark20Regular,
  Dismiss20Regular,
  Play20Regular,
  Info20Regular,
  Database20Regular
} from "@fluentui/react-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToastController } from "@fluentui/react-components";
import { APP_TOASTER_ID } from "@/App";

interface JobStats {
  pending: number;
  processing: number;
  failed: number;
  deadLetter: number;
  completed: number;
}

interface Job {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  error: string | null;
  attemptCount: number;
  maxAttempts: number;
  scheduledFor: string;
  createdAt: string;
  processedAt: string | null;
  lastAttemptAt: string | null;
  deadLetteredAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  meetingId: string | null;
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },
  header: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  pageTitle: {
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightHero800,
  },
  pageSubtitle: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  statCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.padding(tokens.spacingVerticalL),
    textAlign: "center",
  },
  statValue: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightBold,
  },
  statLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  tableContainer: {
    overflowX: "auto",
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
    maxWidth: "300px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  payloadPreview: {
    maxWidth: "200px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontFamily: "monospace",
    fontSize: tokens.fontSizeBase100,
  },
  dialogPayload: {
    fontFamily: "monospace",
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding(tokens.spacingVerticalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    maxHeight: "300px",
    overflowY: "auto",
  },
  tabButtons: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginBottom: tokens.spacingVerticalM,
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "200px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.padding(tokens.spacingVerticalXXL),
    color: tokens.colorNeutralForeground3,
  },
});

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge appearance="tint" color="informative" icon={<Clock20Regular />}>Pending</Badge>;
    case 'processing':
      return <Badge appearance="tint" color="brand" icon={<ArrowSync20Regular />}>Processing</Badge>;
    case 'failed':
      return <Badge appearance="tint" color="warning" icon={<Warning20Regular />}>Failed</Badge>;
    case 'dead_letter':
      return <Badge appearance="tint" color="danger" icon={<Dismiss20Regular />}>Dead Letter</Badge>;
    case 'completed':
      return <Badge appearance="tint" color="success" icon={<Checkmark20Regular />}>Completed</Badge>;
    default:
      return <Badge appearance="tint">{status}</Badge>;
  }
}

export default function AdminJobs() {
  const classes = useStyles();
  const { dispatchToast } = useToastController(APP_TOASTER_ID);
  const [statusFilter, setStatusFilter] = useState<string>('failed');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<JobStats>({
    queryKey: ['/api/admin/jobs/stats'],
  });

  const { data: jobs, isLoading: jobsLoading, refetch } = useQuery<Job[]>({
    queryKey: ['/api/admin/jobs', statusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/jobs?status=${statusFilter}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest('POST', `/api/admin/jobs/${jobId}/retry`);
    },
    onSuccess: () => {
      dispatchToast(
        <Text>Job scheduled for retry - will be picked up by job worker</Text>,
        { intent: 'success', timeout: 3000 }
      );
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs/stats'] });
    },
    onError: (error: Error) => {
      dispatchToast(
        <Text>Retry failed: {error.message}</Text>,
        { intent: 'error', timeout: 5000 }
      );
    },
  });

  const handleRetry = (jobId: string) => {
    retryMutation.mutate(jobId);
  };

  const viewJobDetails = (job: Job) => {
    setSelectedJob(job);
    setDialogOpen(true);
  };

  return (
    <div className={classes.container} data-testid="admin-jobs-page">
      <div className={classes.header}>
        <Text className={classes.pageTitle}>Job Queue Management</Text>
        <Text className={classes.pageSubtitle}>
          Monitor and manage background processing jobs
        </Text>
      </div>

      {/* Stats Overview */}
      <div className={classes.statsGrid}>
        <Card className={classes.statCard}>
          <Text className={classes.statValue} style={{ color: tokens.colorPaletteBlueForeground2 }}>
            {statsLoading ? '-' : stats?.pending ?? 0}
          </Text>
          <Text className={classes.statLabel}>Pending</Text>
        </Card>
        <Card className={classes.statCard}>
          <Text className={classes.statValue} style={{ color: tokens.colorPaletteBlueForeground2 }}>
            {statsLoading ? '-' : stats?.processing ?? 0}
          </Text>
          <Text className={classes.statLabel}>Processing</Text>
        </Card>
        <Card className={classes.statCard}>
          <Text className={classes.statValue} style={{ color: tokens.colorPaletteYellowForeground2 }}>
            {statsLoading ? '-' : stats?.failed ?? 0}
          </Text>
          <Text className={classes.statLabel}>Failed</Text>
        </Card>
        <Card className={classes.statCard}>
          <Text className={classes.statValue} style={{ color: tokens.colorPaletteRedForeground1 }}>
            {statsLoading ? '-' : stats?.deadLetter ?? 0}
          </Text>
          <Text className={classes.statLabel}>Dead Letter</Text>
        </Card>
        <Card className={classes.statCard}>
          <Text className={classes.statValue} style={{ color: tokens.colorPaletteGreenForeground1 }}>
            {statsLoading ? '-' : stats?.completed ?? 0}
          </Text>
          <Text className={classes.statLabel}>Completed</Text>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card>
        <CardHeader
          header={<Text weight="semibold">Job List</Text>}
          action={
            <Button 
              icon={<ArrowSync20Regular />} 
              appearance="subtle" 
              onClick={() => refetch()}
              data-testid="button-refresh-jobs"
            >
              Refresh
            </Button>
          }
        />
        <div className={classes.tabButtons}>
          {['failed', 'dead_letter', 'pending', 'processing', 'completed'].map((status) => (
            <Button
              key={status}
              appearance={statusFilter === status ? 'primary' : 'outline'}
              onClick={() => setStatusFilter(status)}
              data-testid={`button-filter-${status}`}
            >
              {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          ))}
        </div>

        {jobsLoading ? (
          <div className={classes.loadingContainer}>
            <Spinner label="Loading jobs..." />
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className={classes.emptyState}>
            <Database20Regular style={{ fontSize: 48, marginBottom: 16 }} />
            <Text>No {statusFilter.replace('_', ' ')} jobs found</Text>
          </div>
        ) : (
          <div className={classes.tableContainer}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Meeting</TableHeaderCell>
                  <TableHeaderCell>Attempts</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                  <TableHeaderCell>Error</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Text weight="semibold">{job.type}</Text>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(job.status)}
                    </TableCell>
                    <TableCell>
                      {job.meetingId ? (
                        <Tooltip content={job.meetingId} relationship="label">
                          <Text className={classes.payloadPreview}>
                            {job.meetingId.substring(0, 12)}...
                          </Text>
                        </Tooltip>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {job.attemptCount} / {job.maxAttempts}
                    </TableCell>
                    <TableCell>
                      {formatDate(job.createdAt)}
                    </TableCell>
                    <TableCell>
                      {job.error ? (
                        <Tooltip content={job.error} relationship="label">
                          <Text className={classes.errorText}>{job.error}</Text>
                        </Tooltip>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Tooltip content="View details" relationship="label">
                          <Button 
                            icon={<Info20Regular />} 
                            appearance="subtle"
                            size="small"
                            onClick={() => viewJobDetails(job)}
                            data-testid={`button-view-job-${job.id}`}
                          />
                        </Tooltip>
                        {(job.status === 'failed' || job.status === 'dead_letter') && (
                          <Tooltip content="Retry job" relationship="label">
                            <Button 
                              icon={<Play20Regular />} 
                              appearance="subtle"
                              size="small"
                              onClick={() => handleRetry(job.id)}
                              disabled={retryMutation.isPending}
                              data-testid={`button-retry-job-${job.id}`}
                            />
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Job Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Job Details</DialogTitle>
            <DialogContent>
              {selectedJob && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <Text weight="semibold">ID:</Text>
                    <Text style={{ marginLeft: 8 }}>{selectedJob.id}</Text>
                  </div>
                  <div>
                    <Text weight="semibold">Type:</Text>
                    <Text style={{ marginLeft: 8 }}>{selectedJob.type}</Text>
                  </div>
                  <div>
                    <Text weight="semibold">Status:</Text>
                    <span style={{ marginLeft: 8 }}>{getStatusBadge(selectedJob.status)}</span>
                  </div>
                  <div>
                    <Text weight="semibold">Attempts:</Text>
                    <Text style={{ marginLeft: 8 }}>{selectedJob.attemptCount} / {selectedJob.maxAttempts}</Text>
                  </div>
                  <div>
                    <Text weight="semibold">Created:</Text>
                    <Text style={{ marginLeft: 8 }}>{formatDate(selectedJob.createdAt)}</Text>
                  </div>
                  <div>
                    <Text weight="semibold">Last Attempt:</Text>
                    <Text style={{ marginLeft: 8 }}>{formatDate(selectedJob.lastAttemptAt)}</Text>
                  </div>
                  {selectedJob.deadLetteredAt && (
                    <div>
                      <Text weight="semibold">Dead Lettered:</Text>
                      <Text style={{ marginLeft: 8 }}>{formatDate(selectedJob.deadLetteredAt)}</Text>
                    </div>
                  )}
                  {selectedJob.resolvedAt && (
                    <div>
                      <Text weight="semibold">Resolved:</Text>
                      <Text style={{ marginLeft: 8 }}>{formatDate(selectedJob.resolvedAt)} by {selectedJob.resolvedBy}</Text>
                    </div>
                  )}
                  {selectedJob.error && (
                    <div>
                      <Text weight="semibold">Error:</Text>
                      <div className={classes.dialogPayload} style={{ color: tokens.colorPaletteRedForeground1 }}>
                        {selectedJob.error}
                      </div>
                    </div>
                  )}
                  <div>
                    <Text weight="semibold">Payload:</Text>
                    <div className={classes.dialogPayload}>
                      {JSON.stringify(selectedJob.payload, null, 2)}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              {selectedJob && (selectedJob.status === 'failed' || selectedJob.status === 'dead_letter') && (
                <Button 
                  appearance="primary" 
                  icon={<Play20Regular />}
                  onClick={() => {
                    handleRetry(selectedJob.id);
                    setDialogOpen(false);
                  }}
                  disabled={retryMutation.isPending}
                >
                  Retry Job
                </Button>
              )}
              <Button appearance="secondary" onClick={() => setDialogOpen(false)}>
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
