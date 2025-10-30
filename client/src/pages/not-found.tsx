import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6 p-6">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold text-foreground">404</h1>
          <p className="text-xl font-medium text-foreground">Page Not Found</p>
          <p className="text-sm text-muted-foreground max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link href="/">
          <Button data-testid="button-back-home">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
