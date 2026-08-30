import { ConfigWarnings } from '../components/ConfigWarnings';
import { ServersSection } from '../components/settings/ServersSection';
import { ApiKeysSection } from '../components/settings/ApiKeysSection';
import { SmtpSection } from '../components/settings/SmtpSection';
import { GithubIntegrationSection } from '../components/settings/GithubIntegrationSection';

export function Settings() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground mt-1">Configure cluster nodes, API access tokens, notification mailers, and Git integrations.</p>
      </div>
      <ConfigWarnings />
      <div className="grid gap-6">
        <ServersSection />
        <ApiKeysSection />
        <SmtpSection />
        <GithubIntegrationSection />
      </div>
    </div>
  );
}
