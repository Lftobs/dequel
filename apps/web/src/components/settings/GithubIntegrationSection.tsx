import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export function GithubIntegrationSection() {
	const { data, refetch } = useQuery({
		queryKey: ["github-integration"],
		queryFn: () => api.getGithubIntegration(),
	});
	const [clientId, setClientId] = useState("");
	const [clientSecret, setClientSecret] = useState("");
	const [appName, setAppName] = useState("");
	const [webhookSecret, setWebhookSecret] = useState("");
	const [saveResult, setSaveResult] = useState<string | null>(null);

	useEffect(() => {
		if (data?.configured) {
			setClientId(data.clientId || "");
			setAppName(data.appName || "");
		}
	}, [data]);

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaveResult(null);
		try {
			await api.setGithubIntegration({
				clientId: clientId.trim(),
				clientSecret: clientSecret.trim(),
				appName: appName.trim() || undefined,
				webhookSecret: webhookSecret.trim() || undefined,
			});
			setClientSecret("");
			setWebhookSecret("");
			refetch();
			setSaveResult("Settings saved");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			setSaveResult(`error: ${message}`);
		}
	};

	const icon = (
		<svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
		</svg>
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					{icon}
					<CardTitle className="text-lg">GitHub Integration</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<form onSubmit={save} className="flex flex-wrap items-end gap-3 mb-4">
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">Client ID</label>
						<Input
							placeholder="Iv1..."
							value={clientId}
							onChange={(e) => setClientId(e.target.value)}
							className="w-56"
						/>
					</div>
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">Client Secret</label>
						<Input
							type="password"
							placeholder={data?.configured ? "(unchanged)" : ""}
							value={clientSecret}
							onChange={(e) => setClientSecret(e.target.value)}
							className="w-64"
						/>
					</div>
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">App Name</label>
						<Input placeholder="Dequel" value={appName} onChange={(e) => setAppName(e.target.value)} className="w-36" />
					</div>
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">Webhook Secret</label>
						<Input
							type="password"
							placeholder={data?.hasWebhookSecret ? "(unchanged)" : ""}
							value={webhookSecret}
							onChange={(e) => setWebhookSecret(e.target.value)}
							className="w-48"
						/>
					</div>
					<Button type="submit" size="sm">
						Save
					</Button>
				</form>
				{!data?.configured && (
					<p className="text-xs text-amber-400">
						GitHub is not configured. Add your OAuth App credentials to enable the repo picker.
					</p>
				)}
				{saveResult && (
					<p className={`text-xs ${saveResult.startsWith("error") ? "text-red-400" : "text-emerald-400"}`}>
						{saveResult}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
