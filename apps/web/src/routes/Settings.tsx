import { useQuery } from "@tanstack/react-query";
import { Bot, GitBranch, Mail, Server, Settings2, ShieldCheck, Sparkles } from "lucide-react";
import * as api from "../api/client";
import { ConfigWarnings } from "../components/ConfigWarnings";
import { AiIntegrationSection } from "../components/settings/AiIntegrationSection";
import { GithubIntegrationSection } from "../components/settings/GithubIntegrationSection";
import { ServersSection } from "../components/settings/ServersSection";
import { SmtpSection } from "../components/settings/SmtpSection";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export function Settings() {
	const { data: servers = [] } = useQuery({
		queryKey: ["servers"],
		queryFn: () => api.listServers().catch(() => []),
	});

	const { data: github } = useQuery({
		queryKey: ["github-integration"],
		queryFn: () => api.getGithubIntegration().catch(() => null),
	});

	const { data: smtp } = useQuery({
		queryKey: ["smtp-settings"],
		queryFn: () => api.getSmtpSettings().catch(() => null),
	});

	const { data: aiStatus } = useQuery({
		queryKey: ["aiSettings"],
		queryFn: () => api.getAiSettings().catch(() => null),
	});

	const aiConfigured =
		aiStatus?.openaiConfigured ||
		aiStatus?.geminiConfigured ||
		aiStatus?.grokConfigured ||
		aiStatus?.claudeConfigured;

	return (
		<div className="mx-auto max-w-6xl space-y-8 pb-12">
			{/* Hero Header */}
			<div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/80 via-card/40 to-background p-6 md:p-8 backdrop-blur-md shadow-2xl">
				<div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
				<div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

				<div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Badge
								variant="outline"
								className="border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5"
							>
								System Configuration
							</Badge>
						</div>
						<h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
							<Settings2 className="h-7 w-7 text-orange-500" />
							Platform Settings
						</h1>
						<p className="max-w-2xl text-xs md:text-sm text-muted-foreground leading-relaxed">
							Configure cluster infrastructure nodes, AI build diagnostics, external GitHub OAuth provider integrations, and SMTP notification dispatchers.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-inner">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
								<Server className="h-4 w-4" />
							</div>
							<div>
								<div className="text-xs font-semibold text-foreground">{servers.length} Registered</div>
								<div className="text-[10px] text-muted-foreground">Cluster Nodes</div>
							</div>
						</div>

						<div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-inner">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
								<ShieldCheck className="h-4 w-4" />
							</div>
							<div>
								<div className="text-xs font-semibold text-foreground">
									{github?.configured && smtp?.configured ? "Fully Set" : "Action Required"}
								</div>
								<div className="text-[10px] text-muted-foreground">Integrations</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<ConfigWarnings />

			{/* Main Settings Tabs */}
			<Tabs defaultValue="servers" className="space-y-6">
				<TabsList className="bg-card/60 border border-border/60 p-1 rounded-2xl backdrop-blur-md max-w-xl flex overflow-x-auto whitespace-nowrap justify-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden touch-pan-x">
					<TabsTrigger
						value="servers"
						className="rounded-xl text-xs font-medium gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all shrink-0"
					>
						<Server className="h-3.5 w-3.5" />
						Servers & Nodes
					</TabsTrigger>
					<TabsTrigger
						value="ai"
						className="rounded-xl text-xs font-medium gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all shrink-0"
					>
						<Sparkles className="h-3.5 w-3.5" />
						AI Assistant
						{aiConfigured && (
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
						)}
					</TabsTrigger>
					<TabsTrigger
						value="github"
						className="rounded-xl text-xs font-medium gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all shrink-0"
					>
						<GitBranch className="h-3.5 w-3.5" />
						GitHub Integration
					</TabsTrigger>
					<TabsTrigger
						value="smtp"
						className="rounded-xl text-xs font-medium gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all shrink-0"
					>
						<Mail className="h-3.5 w-3.5" />
						SMTP Notifications
					</TabsTrigger>
				</TabsList>

				<TabsContent value="servers">
					<ServersSection />
				</TabsContent>

				<TabsContent value="ai">
					<AiIntegrationSection />
				</TabsContent>

				<TabsContent value="github">
					<GithubIntegrationSection />
				</TabsContent>

				<TabsContent value="smtp">
					<SmtpSection />
				</TabsContent>
			</Tabs>
		</div>
	);
}
