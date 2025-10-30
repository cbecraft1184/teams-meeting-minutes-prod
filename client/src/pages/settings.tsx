import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Bell, Shield, Database, Save, ExternalLink, Info, Webhook } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="heading-settings">
          Integration Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure Microsoft Teams, SharePoint, and Azure OpenAI integrations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Webhook className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Microsoft Teams Integration</CardTitle>
                <CardDescription>Automatically capture meetings from Microsoft Teams</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="text-foreground font-medium">How it works</p>
                  <p className="text-muted-foreground">
                    Meetings are <strong>scheduled and conducted in Microsoft Teams</strong>. This application automatically captures completed meetings via Microsoft Graph API webhooks to process recordings and transcripts.
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
                    <li>Users schedule meetings in Microsoft Teams (not in this app)</li>
                    <li>When meetings end, Teams webhooks notify this application</li>
                    <li>App downloads recordings/transcripts via Microsoft Graph API</li>
                    <li>AI generates meeting minutes automatically</li>
                    <li>Approved minutes are distributed via email and archived to SharePoint</li>
                  </ol>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="tenant-id">Microsoft Tenant ID (DOD)</Label>
              <Input
                id="tenant-id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                data-testid="input-tenant-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-id">Application (Client) ID</Label>
              <Input
                id="client-id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                data-testid="input-client-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-secret">Client Secret</Label>
              <Input
                id="client-secret"
                type="password"
                placeholder="Enter client secret"
                data-testid="input-client-secret"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Webhook Endpoint URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value="/api/webhooks/teams"
                  readOnly
                  className="font-mono text-xs bg-muted"
                  data-testid="input-webhook-url"
                />
                <Button size="sm" variant="outline">Copy</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this endpoint in Microsoft Graph API to receive meeting notifications
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button data-testid="button-test-teams-connection">
                Test Connection
              </Button>
              <Button variant="outline" data-testid="button-save-teams-config">
                <Save className="w-4 h-4 mr-2" />
                Save Configuration
              </Button>
            </div>

            <a
              href="https://learn.microsoft.com/en-us/graph/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Microsoft Graph Webhooks Documentation
              <ExternalLink className="w-3 h-3" />
            </a>
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
