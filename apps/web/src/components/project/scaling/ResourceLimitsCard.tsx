import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Cpu } from "lucide-react";

export const PRESETS = [
	{
		name: "Starter",
		cpu: "0.25",
		memory: "256",
		desc: "Shared CPU / 256MB",
	},
	{
		name: "Standard",
		cpu: "1",
		memory: "512",
		desc: "1 Core / 512MB",
	},
	{
		name: "Professional",
		cpu: "2",
		memory: "1024",
		desc: "2 Cores / 1GB",
	},
];

interface ResourceLimitsCardProps {
	cpuLimit: string;
	setCpuLimit: (v: string) => void;
	memoryLimitMb: string;
	setMemoryLimitMb: (v: string) => void;
	isSavingLimits: boolean;
	onSaveLimits: () => Promise<void>;
	hasLimits: boolean;
}

export function ResourceLimitsCard({
	cpuLimit,
	setCpuLimit,
	memoryLimitMb,
	setMemoryLimitMb,
	isSavingLimits,
	onSaveLimits,
	hasLimits,
}: ResourceLimitsCardProps) {
	const matchedPreset = PRESETS.find(
		(p) => p.cpu === cpuLimit && p.memory === memoryLimitMb,
	);

	return (
		<Card className="bg-card/40 border-border backdrop-blur-sm">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<div className="space-y-1">
					<CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
						<Cpu className="h-5 w-5 text-primary" /> Resource Allocation
					</CardTitle>
					<p className="text-xs text-muted-foreground">
						Set custom limits or select a package for containers.
					</p>
				</div>
				{hasLimits ? (
					<Badge
						variant="outline"
						className="border-primary/20 text-primary bg-primary/5 uppercase text-[10px]"
					>
						{matchedPreset ? matchedPreset.name : "Custom Limit"}
					</Badge>
				) : (
					<Badge
						variant="outline"
						className="border-muted text-muted-foreground uppercase text-[10px]"
					>
						Unlimited
					</Badge>
				)}
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
					{PRESETS.map((p) => {
						const isSelected = cpuLimit === p.cpu && memoryLimitMb === p.memory;
						return (
							<button
								key={p.name}
								type="button"
								onClick={() => {
									setCpuLimit(p.cpu);
									setMemoryLimitMb(p.memory);
								}}
								className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
									isSelected
										? "border-primary bg-primary/5 shadow-md shadow-primary/5"
										: "border-border bg-[#0d0d11] hover:border-border/80 hover:bg-[#121217]"
								}`}
							>
								<span className={`text-xs font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
									{p.name}
								</span>
								<span className="text-[10px] text-muted-foreground mt-0.5">
									{p.desc}
								</span>
							</button>
						);
					})}
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-2">
						<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							CPU Limit (cores)
						</label>
						<div className="relative flex items-center">
							<Input
								type="number"
								min={0}
								step="0.1"
								placeholder="No limit"
								value={cpuLimit}
								onChange={(e) => setCpuLimit(e.target.value)}
								className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary pr-14 text-sm font-semibold rounded-lg"
							/>
							<span className="absolute right-3 text-xs font-semibold text-muted-foreground">
								cores
							</span>
						</div>
					</div>
					<div className="grid gap-2">
						<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Memory Limit (MB)
						</label>
						<div className="relative flex items-center">
							<Input
								type="number"
								min={0}
								step="64"
								placeholder="No limit"
								value={memoryLimitMb}
								onChange={(e) => setMemoryLimitMb(e.target.value)}
								className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary pr-12 text-sm font-semibold rounded-lg"
							/>
							<span className="absolute right-3 text-xs font-semibold text-muted-foreground">
								MB
							</span>
						</div>
					</div>
				</div>

				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
					<button
						type="button"
						onClick={() => {
							setCpuLimit("");
							setMemoryLimitMb("");
						}}
						className="text-xs text-muted-foreground hover:text-foreground underline transition-colors text-left"
					>
						Clear Resource Limits
					</button>
					<Button
						onClick={onSaveLimits}
						disabled={isSavingLimits}
						className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 px-5 rounded-lg shadow-md transition-all w-full sm:w-auto"
					>
						{isSavingLimits ? "Saving Limits..." : "Save Limits"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
