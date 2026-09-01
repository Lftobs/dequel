import { ConfigWarnings } from "../components/ConfigWarnings";
import { ServersSection } from "../components/settings/ServersSection";
import { ApiKeysSection } from "../components/settings/ApiKeysSection";
import { AiIntegrationSection } from "../components/settings/AiIntegrationSection";
import { SmtpSection } from "../components/settings/SmtpSection";
import { GithubIntegrationSection } from "../components/settings/GithubIntegrationSection";

export function Settings() {
	return (
		<div className="space-y-6 max-w-6xl">
			<div>
				<h1 className="text-2xl font-bold text-foreground">Settings</h1>
				<p className="text-xs text-muted-foreground mt-1">
					Configure platform infrastructure, AI build diagnostics, servers, authentication, and notifications.
				</p>
			</div>

			<ConfigWarnings />

			<div className="grid gap-6">
				<AiIntegrationSection />
				<ServersSection />
				<ApiKeysSection />
				<SmtpSection />
				<GithubIntegrationSection />
			</div>
		</div>
	);
}
