import { Card, makeStyles, tokens, shorthands } from "@fluentui/react-components";
import { Link } from "wouter";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  href?: string;
}

const useStyles = makeStyles({
  card: {
    ...shorthands.padding("24px"),
  },
  clickableCard: {
    ...shorthands.padding("24px"),
    cursor: "pointer",
    transitionProperty: "box-shadow, transform",
    transitionDuration: "0.15s",
    transitionTimingFunction: "ease-out",
    ":hover": {
      boxShadow: tokens.shadow8,
    },
    ":active": {
      transform: "scale(0.98)",
    },
  },
  link: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
  },
  content: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap("16px"),
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    marginBottom: "4px",
  },
  value: {
    fontSize: "28px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  description: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginTop: "4px",
  },
  iconContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "48px",
    height: "48px",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorBrandBackground2,
  },
});

export function StatsCard({ title, value, icon: Icon, description, href }: StatsCardProps) {
  const styles = useStyles();
  const testId = `card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`;
  
  const cardContent = (
    <Card 
      className={href ? styles.clickableCard : styles.card} 
      data-testid={testId}
    >
      <div className={styles.content}>
        <div className={styles.textContainer}>
          <p className={styles.title}>{title}</p>
          <p className={styles.value} data-testid={`value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
          {description && (
            <p className={styles.description}>{description}</p>
          )}
        </div>
        <div className={styles.iconContainer}>
          <Icon style={{ width: "24px", height: "24px", color: tokens.colorBrandForeground1 }} />
        </div>
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className={styles.link} data-testid={`link-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
