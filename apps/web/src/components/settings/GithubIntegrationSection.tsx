import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Eye, EyeOff, GitBranch, HelpCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { Badge } from "../ui/badge";
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
	const [showClientSecret, setShowClientSecret] = useState(false);
	const [showWebhookSecret, setShowWebhookSecret] = useState(false);
	const [showGuide, setShowGuide] = useState(false);
	const [copiedCallback, setCopiedCallback] = useState(false);
	const [saveResult, setSaveResult] = useState<string | null>(null);

	const callbackUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/api/v1/auth/github/callback`
			: "http://localhost:3001/api/v1/auth/github/callback";

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
			setSaveResult("GitHub OAuth credentials saved successfully.");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			setSaveResult(`error: ${message}`);
		}
	};

	const handleCopyCallback = () => {
		navigator.clipboard.writeText(callbackUrl);
		setCopiedCallback(true);
		setTimeout(() => setCopiedCallback(false), 2000);
	};

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
			<CardHeader className="border-b border-border/40 pb-5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white ring-1 ring-zinc-700 shrink-0">
							<svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
								<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
							</svg>
						</div>
						<div>
							<div className="flex items-center gap-2 flex-wrap">
								<CardTitle className="text-lg font-semibold text-foreground">GitHub OAuth Integration</CardTitle>
								{data?.configured ? (
									<Badge
										variant="success"
										className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 text-[10px]"
									>
										<ShieldCheck className="h-3 w-3" /> Connected
									</Badge>
								) : (
									<Badge variant="warning" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
										Not Configured
									</Badge>
								)}
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								Connect a GitHub OAuth App to pick repositories and automate push-to-deploy triggers.
							</p>
						</div>
					</div>

					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setShowGuide(!showGuide)}
						className="text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1.5 self-start sm:self-auto"
					>
						<HelpCircle className="h-4 w-4" />
						{showGuide ? "Hide Setup Guide" : "OAuth Setup Guide"}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-6 space-y-6">
				{showGuide && (
					<div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5 space-y-3">
						<div className="text-xs font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
							<GitBranch className="h-4 w-4" />
							Step-by-Step GitHub OAuth Setup
						</div>
						<ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside leading-relaxed">
							<li>
								Go to{" "}
								<a
									href="https://github.com/settings/developers"
									target="_blank"
									rel="noreferrer"
									className="text-orange-400 underline hover:text-orange-300 inline-flex items-center gap-0.5"
								>
									GitHub Developer Settings <ExternalLink className="h-3 w-3 inline" />
								</a>{" "}
								and click <strong>New OAuth App</strong>.
							</li>
							<li>
								Set Application Name to <strong>Dequel Platform</strong>.
							</li>
							<li>
								Set <strong>Authorization Callback URL</strong> to:
								<div className="mt-1.5 flex flex-wrap items-center gap-2">
									<code className="rounded-xl border border-border/80 bg-black/60 px-3 py-1.5 font-mono text-[11px] text-zinc-300 break-all">
										{callbackUrl}
									</code>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={handleCopyCallback}
										className="h-7 text-xs text-orange-400 hover:bg-orange-500/10 gap-1"
									>
										{copiedCallback ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
										{copiedCallback ? "Copied" : "Copy URL"}
									</Button>
								</div>
							</li>
							<li>
								Paste the generated <strong>Client ID</strong> and <strong>Client Secret</strong> below.
							</li>
						</ol>
					</div>
				)}

				<form onSubmit={save} className="space-y-4">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">GitHub Client ID</label>
							<Input
								placeholder="e.g. Iv1.8a92b3c4d5e6f7"
								value={clientId}
								onChange={(e) => setClientId(e.target.value)}
								className="bg-card border-border/80 text-xs font-mono focus:ring-orange-500/50"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">GitHub Client Secret</label>
							<div className="relative flex items-center">
								<Input
									type={showClientSecret ? "text" : "password"}
									placeholder={data?.configured ? "(unchanged)" : "Enter secret..."}
									value={clientSecret}
									onChange={(e) => setClientSecret(e.target.value)}
									className="bg-card border-border/80 text-xs font-mono focus:ring-orange-500/50 pr-10"
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={() => setShowClientSecret(!showClientSecret)}
									className="absolute right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
								>
									{showClientSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
								</Button>
							</div>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">OAuth App Name (Optional)</label>
							<Input
								placeholder="Dequel Production"
								value={appName}
								onChange={(e) => setAppName(e.target.value)}
								className="bg-card border-border/80 text-xs focus:ring-orange-500/50"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">Webhook Secret (Optional)</label>
							<div className="relative flex items-center">
								<Input
									type={showWebhookSecret ? "text" : "password"}
									placeholder={data?.hasWebhookSecret ? "(unchanged)" : "Enter webhook secret..."}
									value={webhookSecret}
									onChange={(e) => setWebhookSecret(e.target.value)}
									className="bg-card border-border/80 text-xs font-mono focus:ring-orange-500/50 pr-10"
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={() => setShowWebhookSecret(!showWebhookSecret)}
									className="absolute right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
								>
									{showWebhookSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
								</Button>
							</div>
						</div>
					</div>

					<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
						{saveResult ? (
							<p
								className={`text-xs font-medium ${saveResult.startsWith("error") ? "text-red-400" : "text-emerald-400"}`}
							>
								{saveResult}
							</p>
						) : (
							<span />
						)}
						<Button
							type="submit"
							size="sm"
							className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs px-5 shadow-md w-full sm:w-auto"
						>
							Save Integration Settings
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
