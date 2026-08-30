import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";

interface SwitchToGitCardProps {
	switchGitUrl: string;
	setSwitchGitUrl: (v: string) => void;
	switchBranch: string;
	setSwitchBranch: (v: string) => void;
	onCancel: () => void;
	onSwitch: () => void;
	isPending: boolean;
}

export function SwitchToGitCard({
	switchGitUrl,
	setSwitchGitUrl,
	switchBranch,
	setSwitchBranch,
	onCancel,
	onSwitch,
	isPending,
}: SwitchToGitCardProps) {
	return (
		<Card className="border-primary/30 bg-primary/5">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm text-foreground">
					Switch deployment source to Git?
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<p className="text-xs text-foreground">
					Enter the git repository URL to create a new deployment from source.
				</p>
				<Input
					placeholder="https://github.com/user/repo.git"
					value={switchGitUrl}
					onChange={(e) => setSwitchGitUrl(e.target.value)}
					className="text-sm"
				/>
				<Input
					placeholder="Branch (optional)"
					value={switchBranch}
					onChange={(e) => setSwitchBranch(e.target.value)}
					className="text-sm"
				/>
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={onCancel}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={onSwitch}
						disabled={!switchGitUrl.trim() || isPending}
					>
						{isPending ? "Switching..." : "Switch"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
