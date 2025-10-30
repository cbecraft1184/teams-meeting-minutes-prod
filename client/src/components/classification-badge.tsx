import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

interface ClassificationBadgeProps {
  level: string;
  size?: "sm" | "default";
}

export function ClassificationBadge({ level, size = "default" }: ClassificationBadgeProps) {
  const getClassificationConfig = (level: string) => {
    switch (level.toUpperCase()) {
      case "SECRET":
        return {
          icon: ShieldAlert,
          className: "bg-destructive text-destructive-foreground border-destructive-border",
          label: "SECRET",
        };
      case "CONFIDENTIAL":
        return {
          icon: Shield,
          className: "bg-chart-3 text-white border-chart-3",
          label: "CONFIDENTIAL",
        };
      case "UNCLASSIFIED":
      default:
        return {
          icon: ShieldCheck,
          className: "bg-muted text-muted-foreground border-muted-border",
          label: "UNCLASSIFIED",
        };
    }
  };

  const config = getClassificationConfig(level);
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${size === "sm" ? "text-xs" : "text-xs"} font-semibold`}
      data-testid={`badge-classification-${level.toLowerCase()}`}
    >
      <Icon className={`${size === "sm" ? "w-3 h-3" : "w-3 h-3"} mr-1`} />
      {config.label}
    </Badge>
  );
}
