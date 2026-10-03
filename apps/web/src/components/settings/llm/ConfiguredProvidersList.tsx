import { ChevronDown, ChevronUp, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { LlmKeyStatus } from "../../../types";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { PROVIDERS } from "./types";

interface ConfiguredProvidersListProps {
	configured: LlmKeyStatus[];
	isLoading: boolean;
	syncingProvider: string | null;
	onSync: (provider: string) => void;
	onEdit: (provider: string) => void;
	onRemove: (provider: string) => void;
}

export function ConfiguredProvidersList({
	configured,
	isLoading,
	syncingProvider,
	onSync,
	onEdit,
	onRemove,
}: ConfiguredProvidersListProps) {
	const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
			<CardHeader className="border-b border-border/40 pb-4">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-sm font-semibold text-foreground">Configured Providers</CardTitle>
						<p className="text-xs text-muted-foreground mt-0.5">
							Active providers ready to run failure root-cause analysis
						</p>
					</div>
					<Badge variant="outline" className="text-xs font-mono">
						{configured.length} configured
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="pt-4">
				{isLoading ? (
					<div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
						<RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading providers…
					</div>
				) : configured.length === 0 ? (
					<div className="py-8 text-center text-xs text-muted-foreground space-y-1">
						<p className="font-medium text-foreground">No providers configured yet</p>
						<p>Choose a provider above and enter your key to enable automated AI diagnosis.</p>
					</div>
				) : (
					<div className="divide-y divide-border/40">
						{configured.map((item) => {
							const meta = PROVIDERS.find((p) => p.id === item.provider);
							const isExpanded = expandedProvider === item.provider;
							const modelsList = item.models ?? [];
							const isSyncing = syncingProvider === item.provider;

							return (
								<div key={item.provider} className="py-3.5 first:pt-0 last:pb-0 space-y-2.5">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
										<div className="space-y-1">
											<div className="flex items-center gap-2 flex-wrap">
												<span className="text-sm font-semibold text-foreground">{meta?.label ?? item.provider}</span>
												<span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
													<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
													Connected
												</span>
												<Badge
													variant="outline"
													className="text-[10px] font-mono border-border/80 bg-background/50 px-2 py-0"
												>
													{modelsList.length} {modelsList.length === 1 ? "model" : "models"} cached
												</Badge>
											</div>

											{item.baseUrl && (
												<p className="text-xs font-mono text-muted-foreground truncate max-w-md">{item.baseUrl}</p>
											)}
										</div>

										<div className="flex items-center gap-2 self-end sm:self-center">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => onSync(item.provider)}
												disabled={isSyncing}
												className="h-8 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1.5"
											>
												<RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
												{isSyncing ? "Syncing..." : "Sync"}
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => onEdit(item.provider)}
												className="h-8 text-xs"
											>
												Edit
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => onRemove(item.provider)}
												className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									</div>

									{modelsList.length > 0 && (
										<div className="pt-1">
											<div className="flex flex-wrap items-center gap-1.5">
												{(isExpanded ? modelsList : modelsList.slice(0, 5)).map((m) => (
													<span
														key={m}
														className="rounded border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
													>
														{m}
													</span>
												))}
												{modelsList.length > 5 && (
													<button
														type="button"
														onClick={() => setExpandedProvider(isExpanded ? null : item.provider)}
														className="text-[10px] text-orange-400 hover:underline font-mono inline-flex items-center gap-0.5 ml-1"
													>
														{isExpanded ? (
															<>
																Show less <ChevronUp className="h-2.5 w-2.5" />
															</>
														) : (
															<>
																+{modelsList.length - 5} more <ChevronDown className="h-2.5 w-2.5" />
															</>
														)}
													</button>
												)}
											</div>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
