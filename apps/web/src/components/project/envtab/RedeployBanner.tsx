import { Button } from "../../ui/button";
import { RefreshCw } from "lucide-react";

interface RedeployBannerProps {
	show: boolean;
	runningDeploymentId: string | undefined;
	isPending: boolean;
	onDismiss: () => void;
	onRedeploy: () => Promise<void>;
}

export function RedeployBanner({
	show,
	runningDeploymentId,
	isPending,
	onDismiss,
	onRedeploy,
}: RedeployBannerProps) {
	if (!show || !runningDeploymentId) return null;

	return (
		<div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 gap-3 animate-in fade-in-0 duration-200">
			<div className="flex items-start gap-3">
				<div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/15">
					<RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
				</div>
				<div>
					<h4 className="text-sm font-semibold text-foreground">
						Redeployment Required
					</h4>
					<p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
						You have added or updated environment variables. Redeploy the active
						configuration to apply the new settings.
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
				<Button
					variant="ghost"
					size="sm"
					onClick={onDismiss}
					className="text-xs h-8 px-3 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
					disabled={isPending}
				>
					Dismiss
				</Button>
				<Button
					size="sm"
					onClick={onRedeploy}
					disabled={isPending}
					className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-xs h-8 px-4 rounded-lg shadow-md hover:shadow-primary/10 transition-all flex items-center gap-1.5"
				>
					{isPending ? (
						<>
							<RefreshCw className="h-3.5 w-3.5 animate-spin" />
							Redeploying...
						</>
					) : (
						<>
							<RefreshCw className="h-3.5 w-3.5" />
							Redeploy Now
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
