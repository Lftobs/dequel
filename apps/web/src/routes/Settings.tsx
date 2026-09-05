import { ConfigWarnings } from "../components/ConfigWarnings";
import { ServersSection } from "../components/settings/ServersSection";
import { ApiKeysSection } from "../components/settings/ApiKeysSection";
import { SmtpSection } from "../components/settings/SmtpSection";
import { GithubIntegrationSection } from "../components/settings/GithubIntegrationSection";
import { DeleteProjectsSection } from "../components/settings/DeleteProjectsSection";

export function Settings() {
	return (
		<div className="space-y-6 max-w-6xl">
			<div>
				<h1 className="text-2xl font-bold text-foreground">Settings</h1>
				<p className="text-xs text-muted-foreground mt-1">
					Manage platform servers, API keys, notifications, integrations, and project deletion.
				</p>
			</div>

			<ConfigWarnings />

			<div className="grid gap-6">
				<ServersSection />
				<ApiKeysSection />
				<SmtpSection />
				<GithubIntegrationSection />
				<DeleteProjectsSection />
			</div>
		</div>
	);
}
