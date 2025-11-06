import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Bell, Shield, Database, Save, ExternalLink, Info, Webhook, User, CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface UserPermissions {
  canView: boolean;
  canViewAll: boolean;
  canApprove: boolean;
  canManageUsers: boolean;
  canConfigureIntegrations: boolean;
  clearanceLevel: string;
  role: string;
  azureAdGroupsActive: boolean;
}

interface UserInfo {
  user: {
    id: number;
    email: string;
    displayName: string;
    role: string;
    clearanceLevel: string;
    department: string | null;
    organizationalUnit: string | null;
  };
  permissions: UserPermissions;
}

export default function Settings() {
  // Fetch current user permissions and Azure AD group status
  const { data: userInfo, isLoading: isLoadingUser } = useQuery<UserInfo>({
    queryKey: ["/api/user/me"],
  });
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>User Permissions & Authorization</CardTitle>
                <CardDescription>Your access level and Azure AD group status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingUser ? (
              <div className="text-sm text-muted-foreground">Loading permissions...</div>
            ) : userInfo ? (
              <>
                <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Authorization Source</span>
                    <Badge variant={userInfo.permissions?.azureAdGroupsActive ? "default" : "secondary"}>
                      {userInfo.permissions?.azureAdGroupsActive ? (
                        <><CheckCircle2 className="w-3 h-3 mr-1" /> Azure AD Groups</>
                      ) : (
                        <><Info className="w-3 h-3 mr-1" /> Database Fallback</>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Effective Role</span>
                    <Badge variant="outline">{userInfo.permissions?.role}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Clearance Level</span>
                    <Badge variant="outline">{userInfo.permissions?.clearanceLevel}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Permissions</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      {userInfo.permissions?.canViewAll ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={userInfo.permissions?.canViewAll ? "text-foreground" : "text-muted-foreground"}>
                        View All Meetings (Admin/Auditor)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {userInfo.permissions?.canApprove ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={userInfo.permissions?.canApprove ? "text-foreground" : "text-muted-foreground"}>
                        Approve Meeting Minutes
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {userInfo.permissions?.canManageUsers ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={userInfo.permissions?.canManageUsers ? "text-foreground" : "text-muted-foreground"}>
                        Manage Users (Admin Only)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {userInfo.permissions?.canConfigureIntegrations ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={userInfo.permissions?.canConfigureIntegrations ? "text-foreground" : "text-muted-foreground"}>
                        Configure Integrations (Admin Only)
                      </span>
                    </div>
                  </div>
                </div>

                {userInfo.permissions?.azureAdGroupsActive && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                      <div className="space-y-1 text-sm">
                        <p className="text-green-900 dark:text-green-100 font-medium">Azure AD Integration Active</p>
                        <p className="text-green-700 dark:text-green-300 text-xs">
                          Permissions are managed through Azure AD security groups. Changes to your Azure AD group membership will be reflected within 15 minutes.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!userInfo.permissions?.azureAdGroupsActive && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                      <div className="space-y-1 text-sm">
                        <p className="text-yellow-900 dark:text-yellow-100 font-medium">Database Fallback Mode</p>
                        <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                          Permissions are currently sourced from the database. Azure AD groups integration is not active or unavailable. Contact your administrator to enable Azure AD integration.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Failed to load permissions</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
