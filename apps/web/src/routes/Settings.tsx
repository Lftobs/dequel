import { ConfigWarnings } from "../components/ConfigWarnings";
import { GithubIntegrationSection } from "../components/settings/GithubIntegrationSection";
import { ServersSection } from "../components/settings/ServersSection";
import { SmtpSection } from "../components/settings/SmtpSection";

export function Settings() {
	return (
		<div className="space-y-6 max-w-6xl">
			<div>
				<h1 className="text-2xl font-bold text-foreground">Settings</h1>
				<p className="text-xs text-muted-foreground mt-1">Manage platform servers, notifications, and integrations.</p>
			</div>

			<ConfigWarnings />

			<div className="grid gap-6">
				<ServersSection />
				<SmtpSection />
				<GithubIntegrationSection />
			</div>
		</div>
	);
}
