import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface ProcessingStatusProps {
  status: string;
}

export function ProcessingStatus({ status }: ProcessingStatusProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          label: "Pending",
          className: "bg-muted text-muted-foreground",
        };
      case "transcribing":
        return {
          icon: Loader2,
          label: "Transcribing...",
          className: "bg-primary/10 text-primary",
          animated: true,
        };
      case "generating":
        return {
          icon: Loader2,
          label: "Generating Minutes...",
          className: "bg-primary/10 text-primary",
          animated: true,
        };
      case "completed":
        return {
          icon: CheckCircle2,
          label: "Completed",
          className: "bg-chart-2/10 text-chart-2",
        };
      case "failed":
        return {
          icon: AlertCircle,
          label: "Failed",
          className: "bg-destructive/10 text-destructive",
        };
      default:
        return {
          icon: Clock,
          label: status,
          className: "bg-muted text-muted-foreground",
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className} data-testid={`status-processing-${status}`}>
      <Icon className={`w-3 h-3 mr-1 ${config.animated ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}
