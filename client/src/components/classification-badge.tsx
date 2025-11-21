import { Badge, makeStyles, tokens, mergeClasses, shorthands } from "@fluentui/react-components";
import { Shield20Regular, ShieldError20Regular, ShieldCheckmark20Regular } from "@fluentui/react-icons";

interface ClassificationBadgeProps {
  level: string;
  size?: "sm" | "default";
}

const useStyles = makeStyles({
  badge: {
    fontWeight: tokens.fontWeightSemibold,
  },
  iconSmall: {
    width: "12px",
    height: "12px",
    marginRight: "4px",
  },
  secret: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground2,
    ...shorthands.border("1px", "solid", tokens.colorPaletteRedBorder2),
  },
  confidential: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: tokens.colorPaletteYellowForeground2,
    ...shorthands.border("1px", "solid", tokens.colorPaletteYellowBorder2),
  },
  unclassified: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
});

export function ClassificationBadge({ level, size = "default" }: ClassificationBadgeProps) {
  const styles = useStyles();

  const getClassificationConfig = (level: string) => {
    switch (level.toUpperCase()) {
      case "SECRET":
        return {
          icon: <ShieldError20Regular className={styles.iconSmall} />,
          styleClass: styles.secret,
          label: "SECRET",
        };
      case "CONFIDENTIAL":
        return {
          icon: <Shield20Regular className={styles.iconSmall} />,
          styleClass: styles.confidential,
          label: "CONFIDENTIAL",
        };
      case "UNCLASSIFIED":
      default:
        return {
          icon: <ShieldCheckmark20Regular className={styles.iconSmall} />,
          styleClass: styles.unclassified,
          label: "UNCLASSIFIED",
        };
    }
  };

  const config = getClassificationConfig(level);

  return (
    <Badge 
      appearance="outline"
      className={mergeClasses(styles.badge, config.styleClass)}
      icon={config.icon}
      data-testid={`badge-classification-${level.toLowerCase()}`}
    >
      {config.label}
    </Badge>
  );
}
