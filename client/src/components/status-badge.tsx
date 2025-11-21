import { Badge } from "@/components/fluent";
import { Calendar, Clock, CheckCircle2, Archive } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "scheduled":
        return {
          icon: Calendar,
          variant: "tint" as const,
          label: "Scheduled",
        };
      case "in_progress":
        return {
          icon: Clock,
          variant: "filled" as const,
          label: "In Progress",
        };
      case "completed":
        return {
          icon: CheckCircle2,
          variant: "outline" as const,
          label: "Completed",
        };
      case "archived":
        return {
          icon: Archive,
          variant: "ghost" as const,
          label: "Archived",
        };
      default:
        return {
          icon: Calendar,
          variant: "tint" as const,
          label: status,
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant}
      data-testid={`badge-status-${status}`}
      icon={<Icon />}
    >
      {config.label}
    </Badge>
  );
}
