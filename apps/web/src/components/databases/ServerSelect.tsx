import { Laptop, Server, ServerIcon } from "lucide-react";
import type { Server as DequelServer } from "../../types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

function getDeploymentTargets(servers: DequelServer[]): DequelServer[] {
	return servers.filter(
		(s) => s.status === "connected" && (s.mode === "local" || s.mode === "ssh" || s.mode === "agent"),
	);
}

interface ServerSelectProps {
	value: string;
	onChange: (value: string) => void;
	servers: DequelServer[];
	id?: string;
}

export function ServerSelect({ value, onChange, servers, id }: ServerSelectProps) {
	const targets = getDeploymentTargets(servers);

	if (targets.length <= 1) return null;

	return (
		<div className="space-y-1.5">
			<label htmlFor={id} className="text-xs font-semibold text-foreground">
				Deployment Server
			</label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger id={id} className="bg-background/50 border-border/80 text-xs rounded-xl h-10">
					<SelectValue placeholder="Select a server" />
				</SelectTrigger>
				<SelectContent className="bg-card border-border text-xs">
					{targets.map((s) => (
						<SelectItem key={s.id} value={s.id}>
							<span className="flex items-center gap-2">
								{s.mode === "local" ? (
									<Laptop className="h-3.5 w-3.5 text-orange-500" />
								) : (
									<ServerIcon className="h-3.5 w-3.5 text-emerald-500" />
								)}
								<span className="font-medium">{s.mode === "local" ? "Local Server" : s.name}</span>
								<span className="text-muted-foreground">({s.host})</span>
							</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
