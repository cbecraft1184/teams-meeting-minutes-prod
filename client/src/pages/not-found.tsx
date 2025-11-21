import { Button, makeStyles, tokens, shorthands } from "@fluentui/react-components";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  content: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXL),
    ...shorthands.padding(tokens.spacingHorizontalXL),
  },
  iconContainer: {
    display: "flex",
    justifyContent: "center",
  },
  iconCircle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "80px",
    height: "80px",
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  textContainer: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  heading404: {
    fontSize: tokens.fontSizeHero900,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  headingNotFound: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightMedium,
    color: tokens.colorNeutralForeground1,
  },
  description: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    maxWidth: "400px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  alertIcon: {
    width: "40px",
    height: "40px",
    color: tokens.colorPaletteRedForeground1,
  },
});

export default function NotFound() {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconContainer}>
          <div className={styles.iconCircle}>
            <AlertCircle className={styles.alertIcon} />
          </div>
        </div>
        <div className={styles.textContainer}>
          <h1 className={styles.heading404}>404</h1>
          <p className={styles.headingNotFound}>Page Not Found</p>
          <p className={styles.description}>
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link href="/">
          <Button appearance="primary" data-testid="button-back-home">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
