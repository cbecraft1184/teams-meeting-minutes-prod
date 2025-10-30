import { Badge } from "@/components/ui/badge";
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
          variant: "secondary" as const,
          label: "Scheduled",
        };
      case "in_progress":
        return {
          icon: Clock,
          variant: "default" as const,
          label: "In Progress",
        };
      case "completed":
        return {
          icon: CheckCircle2,
          variant: "outline" as const,
          label: "Completed",
          className: "border-chart-2 text-chart-2",
        };
      case "archived":
        return {
          icon: Archive,
          variant: "outline" as const,
          label: "Archived",
          className: "border-muted-foreground text-muted-foreground",
        };
      default:
        return {
          icon: Calendar,
          variant: "secondary" as const,
          label: status,
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={config.className}
      data-testid={`badge-status-${status}`}
    >
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}
