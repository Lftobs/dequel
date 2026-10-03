import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Link2, LinkIcon, Plus, Share2, Unlink, X } from "lucide-react";
import { useState } from "react";
import * as api from "../../../api/client";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

interface LinkedSharedEnvVarsProps {
	projectId: string;
	onLinkedChange?: () => void;
}

export function LinkedSharedEnvVars({ projectId, onLinkedChange }: LinkedSharedEnvVarsProps) {
	const queryClient = useQueryClient();
	const [isExpanded, setIsExpanded] = useState(false);

	const { data: linked = [] } = useQuery({
		queryKey: ["shared-env-links", projectId],
		queryFn: () => api.listLinkedSharedEnvVars(projectId),
	});

	const { data: allShared = [] } = useQuery({
		queryKey: ["shared-env-vars"],
		queryFn: () => api.listSharedEnvVars().catch(() => []),
	});

	const linkMutation = useMutation({
		mutationFn: (ids: string[]) => api.linkSharedEnvVars(projectId, ids),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shared-env-links", projectId] });
			onLinkedChange?.();
		},
	});

	const unlinkMutation = useMutation({
		mutationFn: (linkId: string) => api.unlinkSharedEnvVar(projectId, linkId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shared-env-links", projectId] });
			onLinkedChange?.();
		},
	});

	const linkedIds = new Set(linked.map((l: any) => l.id));
	const available = allShared.filter((s: any) => !linkedIds.has(s.id));

	const handleLink = (id: string) => {
		linkMutation.mutate([id]);
	};

	const handleLinkAll = () => {
		if (available.length === 0) return;
		linkMutation.mutate(available.map((s: any) => s.id));
	};

	return (
		<div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
			>
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
						<Share2 className="h-4 w-4" />
					</div>
					<div className="text-left">
						<div className="text-xs font-semibold text-foreground">Shared Variables</div>
						<div className="text-[10px] text-muted-foreground">
							{linked.length} linked
							{linked.length === 1 ? " variable" : " variables"}
							{available.length > 0 && ` · ${available.length} available`}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{linked.length > 0 && (
						<Badge variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20">
							{linked.length}
						</Badge>
					)}
					<LinkIcon className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
				</div>
			</button>

			{isExpanded && (
				<div className="border-t border-border/40 p-4 space-y-4">
					{linked.length > 0 && (
						<div className="space-y-2">
							<div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linked</div>
							<div className="space-y-1">
								{linked.map((v: any) => (
									<div
										key={v.id}
										className="flex items-center justify-between gap-2 rounded-lg bg-orange-500/5 border border-orange-500/10 px-3 py-2"
									>
										<div className="flex items-center gap-2 min-w-0">
											<Check className="h-3.5 w-3.5 text-orange-500 shrink-0" />
											<Badge
												variant="outline"
												className="font-mono text-[10px] bg-black/40 border-border/60 text-orange-300 truncate"
											>
												{v.key}
											</Badge>
											{v.description && (
												<span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
													{v.description}
												</span>
											)}
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
											onClick={() => unlinkMutation.mutate(v.linkId)}
											disabled={unlinkMutation.isPending}
										>
											<Unlink className="h-3.5 w-3.5" />
										</Button>
									</div>
								))}
							</div>
						</div>
					)}

					{available.length > 0 && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Available</div>
								{available.length > 1 && (
									<Button
										variant="ghost"
										size="sm"
										className="h-6 text-[10px] text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1"
										onClick={handleLinkAll}
										disabled={linkMutation.isPending}
									>
										<Plus className="h-3 w-3" /> Link All
									</Button>
								)}
							</div>
							<div className="space-y-1">
								{available.map((v: any) => (
									<div
										key={v.id}
										className="flex items-center justify-between gap-2 rounded-lg bg-muted/20 border border-border/40 px-3 py-2 hover:bg-muted/30 transition-colors"
									>
										<div className="flex items-center gap-2 min-w-0">
											<Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
											<Badge
												variant="outline"
												className="font-mono text-[10px] bg-black/40 border-border/60 text-zinc-400 truncate"
											>
												{v.key}
											</Badge>
											{v.description && (
												<span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
													{v.description}
												</span>
											)}
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-muted-foreground hover:text-orange-400 hover:bg-orange-500/10 shrink-0"
											onClick={() => handleLink(v.id)}
											disabled={linkMutation.isPending}
										>
											<Plus className="h-3.5 w-3.5" />
										</Button>
									</div>
								))}
							</div>
						</div>
					)}

					{linked.length === 0 && available.length === 0 && (
						<div className="text-center py-4">
							<p className="text-xs text-muted-foreground">
								No shared variables defined yet. Create them in{" "}
								<span className="text-orange-400 font-medium">Settings → Shared Env</span>.
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
