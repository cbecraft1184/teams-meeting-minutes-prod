import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Bell, Shield, Database, Save } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="heading-settings">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your meeting minutes management preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Microsoft Teams Integration</CardTitle>
                <CardDescription>Configure Teams webhook and API access</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teams-webhook">Teams Webhook URL</Label>
              <Input
                id="teams-webhook"
                placeholder="https://your-domain.com/api/webhooks/teams"
                data-testid="input-teams-webhook"
              />
              <p className="text-xs text-muted-foreground">
                This webhook will receive meeting events from Microsoft Teams
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-id">Microsoft Tenant ID</Label>
              <Input
                id="tenant-id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                data-testid="input-tenant-id"
              />
            </div>
            <Button className="w-full" data-testid="button-save-teams-config">
              <Save className="w-4 h-4 mr-2" />
              Save Teams Configuration
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>SharePoint Configuration</CardTitle>
                <CardDescription>Set up document archival location</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sharepoint-site">SharePoint Site URL</Label>
              <Input
                id="sharepoint-site"
                placeholder="https://yourorg.sharepoint.com/sites/meetings"
                data-testid="input-sharepoint-site"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-library">Document Library</Label>
              <Input
                id="document-library"
                placeholder="Meeting Minutes"
                defaultValue="Meeting Minutes"
                data-testid="input-document-library"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-card-border p-4">
              <div className="space-y-0.5">
                <Label>Auto-Archive Completed Minutes</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically upload to SharePoint when processing completes
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-auto-archive" />
            </div>
            <Button className="w-full" data-testid="button-save-sharepoint-config">
              <Save className="w-4 h-4 mr-2" />
              Save SharePoint Configuration
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Manage notification preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-card-border p-4">
              <div className="space-y-0.5">
                <Label>Meeting Completion Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when minutes are generated
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-completion-alerts" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-card-border p-4">
              <div className="space-y-0.5">
                <Label>Processing Failure Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when processing fails
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-failure-alerts" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-card-border p-4">
              <div className="space-y-0.5">
                <Label>Daily Summary Reports</Label>
                <p className="text-xs text-muted-foreground">
                  Receive daily summary of all meetings
                </p>
              </div>
              <Switch data-testid="switch-daily-reports" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <SettingsIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>AI Processing</CardTitle>
                <CardDescription>Configure AI-powered minute generation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-card-border p-4">
              <div className="space-y-0.5">
                <Label>Automatic Processing</Label>
                <p className="text-xs text-muted-foreground">
                  Process transcripts automatically when available
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-auto-processing" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-card-border p-4">
              <div className="space-y-0.5">
                <Label>Extract Action Items</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically identify and extract action items
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-extract-actions" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classification-default">Default Classification Level</Label>
              <select
                id="classification-default"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                data-testid="select-default-classification"
              >
                <option value="UNCLASSIFIED">Unclassified</option>
                <option value="CONFIDENTIAL">Confidential</option>
                <option value="SECRET">Secret</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
