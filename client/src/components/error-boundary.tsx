import { Component, ErrorInfo, ReactNode } from 'react';
import { Button, makeStyles, tokens, shorthands } from "@fluentui/react-components";
import { DismissCircle24Regular, ArrowClockwise20Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.padding("16px"),
    backgroundColor: tokens.colorNeutralBackground1,
  },
  card: {
    width: "100%",
    maxWidth: "512px",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.padding("24px"),
  },
  header: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("12px"),
    marginBottom: "16px",
  },
  iconContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "48px",
    height: "48px",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorPaletteRedBackground2,
  },
  icon: {
    width: "24px",
    height: "24px",
    color: tokens.colorPaletteRedForeground1,
  },
  title: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "4px",
  },
  description: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  errorBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    ...shorthands.padding("12px"),
    marginBottom: "16px",
  },
  errorText: {
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground2,
    wordBreak: "break-all" as const,
  },
});

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

function ErrorDisplay({ error, onReset }: { error?: Error; onReset: () => void }) {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconContainer}>
            <DismissCircle24Regular className={styles.icon} />
          </div>
          <div>
            <div className={styles.title}>Something went wrong</div>
            <div className={styles.description}>
              An unexpected error occurred in the application
            </div>
          </div>
        </div>
        <div className={styles.errorBox}>
          <div className={styles.errorText}>
            {error?.message || 'Unknown error'}
          </div>
        </div>
        <Button
          onClick={onReset}
          appearance="primary"
          style={{ width: "100%" }}
          data-testid="button-reload"
        >
          <ArrowClockwise20Regular style={{ marginRight: "8px" }} />
          Reload Application
        </Button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorDisplay error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}
