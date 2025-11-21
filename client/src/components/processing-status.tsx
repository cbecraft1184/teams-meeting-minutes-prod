import { Badge, makeStyles, tokens, mergeClasses, shorthands } from "@fluentui/react-components";
import { Clock20Regular, Checkmark20Regular, DismissCircle20Regular } from "@fluentui/react-icons";
import { Loader2 } from "lucide-react";

interface ProcessingStatusProps {
  status: string;
}

const spinKeyframes = {
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
};

const useStyles = makeStyles({
  badge: {
    fontWeight: tokens.fontWeightSemibold,
  },
  iconSmall: {
    width: "12px",
    height: "12px",
    marginRight: "4px",
  },
  spinner: {
    animationName: spinKeyframes,
    animationDuration: "1s",
    animationIterationCount: "infinite",
    animationTimingFunction: "linear",
  },
  pending: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
  },
  processing: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
  },
  completed: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground2,
  },
  failed: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground2,
  },
});

export function ProcessingStatus({ status }: ProcessingStatusProps) {
  const styles = useStyles();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return {
          icon: <Clock20Regular className={styles.iconSmall} />,
          label: "Pending",
          styleClass: styles.pending,
        };
      case "transcribing":
        return {
          icon: <Loader2 className={mergeClasses(styles.iconSmall, styles.spinner)} />,
          label: "Transcribing...",
          styleClass: styles.processing,
        };
      case "generating":
        return {
          icon: <Loader2 className={mergeClasses(styles.iconSmall, styles.spinner)} />,
          label: "Generating Minutes...",
          styleClass: styles.processing,
        };
      case "completed":
        return {
          icon: <Checkmark20Regular className={styles.iconSmall} />,
          label: "Completed",
          styleClass: styles.completed,
        };
      case "failed":
        return {
          icon: <DismissCircle20Regular className={styles.iconSmall} />,
          label: "Failed",
          styleClass: styles.failed,
        };
      default:
        return {
          icon: <Clock20Regular className={styles.iconSmall} />,
          label: status,
          styleClass: styles.pending,
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      appearance="outline"
      className={mergeClasses(styles.badge, config.styleClass)}
      icon={config.icon}
      data-testid={`status-processing-${status}`}
    >
      {config.label}
    </Badge>
  );
}
