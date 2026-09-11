import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check, Copy, Key, KeyRound, Shield, Terminal, Zap } from "lucide-react";
import { useState } from "react";
import * as api from "../api/client";
import { ApiKeysSection } from "../components/settings/ApiKeysSection";
import { SshKeyPoolSection } from "../components/settings/SshKeyPoolSection";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export function Keys() {
	const { data: apiKeys = [] } = useQuery({
		queryKey: ["api-keys"],
		queryFn: () => api.listApiKeys().catch(() => []),
	});

	const { data: sshKeys = [] } = useQuery({
		queryKey: ["ssh-keys"],
		queryFn: () => api.listSshKeys().catch(() => []),
	});

	const [copiedCurl, setCopiedCurl] = useState(false);

	const curlSnippet = `curl -H "Authorization: Bearer <YOUR_DEQUEL_API_KEY>" \\
  ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"}/api/v1/projects`;

	const handleCopyCurl = () => {
		navigator.clipboard.writeText(curlSnippet);
		setCopiedCurl(true);
		setTimeout(() => setCopiedCurl(false), 2000);
	};

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
								Credential Control Center
							</Badge>
						</div>
						<h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
							<KeyRound className="h-7 w-7 text-orange-500" />
							Keys & Access Tokens
						</h1>
						<p className="max-w-2xl text-xs md:text-sm text-muted-foreground leading-relaxed">
							Manage system credentials, API tokens for CI/CD runners, and SSH keys used for remote cluster server
							management.
						</p>
					</div>

					<div className="w-full grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap items-center sm:gap-3">
						<div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-inner">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
								<Key className="h-4 w-4" />
							</div>
							<div>
								<div className="text-xs font-semibold text-foreground">{apiKeys.length} Active</div>
								<div className="text-[10px] text-muted-foreground">API Tokens</div>
							</div>
						</div>

						<div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-inner">
							<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
								<Shield className="h-4 w-4" />
							</div>
							<div>
								<div className="text-xs font-semibold text-foreground">{sshKeys.length} Keys</div>
								<div className="text-[10px] text-muted-foreground">SSH Pool</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Main Tabs Navigation */}
			<Tabs defaultValue="api-tokens" className="space-y-6">
				<TabsList className="bg-card/60 border border-border/60 p-1 rounded-2xl backdrop-blur-md max-w-md flex overflow-x-auto whitespace-nowrap justify-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden touch-pan-x">
					<TabsTrigger
						value="api-tokens"
						className="rounded-xl text-xs font-medium gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all shrink-0"
					>
						<Zap className="h-3.5 w-3.5" />
						API Tokens
					</TabsTrigger>
					<TabsTrigger
						value="ssh-keys"
						className="rounded-xl text-xs font-medium gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all shrink-0"
					>
						<KeyRound className="h-3.5 w-3.5" />
						SSH Key Pool
					</TabsTrigger>
					<TabsTrigger
						value="cli-guide"
						className="rounded-xl text-xs font-medium gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all shrink-0"
					>
						<Terminal className="h-3.5 w-3.5" />
						CLI & API Guide
					</TabsTrigger>
				</TabsList>

				<TabsContent value="api-tokens">
					<ApiKeysSection />
				</TabsContent>

				<TabsContent value="ssh-keys">
					<SshKeyPoolSection />
				</TabsContent>

				<TabsContent value="cli-guide">
					<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl">
						<CardHeader>
							<div className="flex items-center gap-2">
								<BookOpen className="h-5 w-5 text-orange-500" />
								<CardTitle className="text-lg font-semibold text-foreground">API Integration & CLI Guide</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-6 pt-2">
							<div className="space-y-2">
								<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Authenticating via HTTP Header
								</h3>
								<p className="text-xs text-muted-foreground leading-relaxed">
									Include your generated API token in the{" "}
									<code className="text-orange-400 bg-black/40 px-1.5 py-0.5 rounded font-mono">Authorization</code>{" "}
									header as a Bearer token:
								</p>
								<div className="relative rounded-2xl border border-border/80 bg-black/60 p-4 font-mono text-xs text-zinc-300">
									<pre className="overflow-x-auto whitespace-pre-wrap sm:pr-24 pb-8 sm:pb-0">{curlSnippet}</pre>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={handleCopyCurl}
										className="absolute right-3 bottom-3 sm:bottom-auto sm:top-3 h-8 bg-card/80 hover:bg-card text-xs text-zinc-300 gap-1.5 px-3 rounded-lg border border-border/40"
									>
										{copiedCurl ? (
											<>
												<Check className="h-3.5 w-3.5 text-emerald-400" />
												Copied
											</>
										) : (
											<>
												<Copy className="h-3.5 w-3.5 text-muted-foreground" />
												Copy cURL
											</>
										)}
									</Button>
								</div>
							</div>

							<div className="grid gap-4 sm:grid-cols-2 pt-2">
								<div className="rounded-2xl border border-border/40 bg-background/30 p-4 space-y-1.5">
									<h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
										<Shield className="h-4 w-4 text-emerald-400" />
										Token Security Best Practices
									</h4>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Store tokens in secret managers or GitHub Repository Secrets (`DEQUEL_API_KEY`). Never commit raw
										keys to source control.
									</p>
								</div>
								<div className="rounded-2xl border border-border/40 bg-background/30 p-4 space-y-1.5">
									<h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
										<KeyRound className="h-4 w-4 text-orange-400" />
										Automatic Revocation
									</h4>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Revoking a key instantly invalidates all active deployments and API connections using that specific
										key hash.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
