import { Input } from "../../ui/input";

interface StepResourcesProps {
	cpuLimit: string;
	setCpuLimit: (value: string) => void;
	memoryLimitMb: string;
	setMemoryLimitMb: (value: string) => void;
	provisionDb?: boolean;
	setProvisionDb?: (value: boolean) => void;
	dbType?: unknown;
	setDbType?: (value: any) => void;
	dbVersion?: string;
	setDbVersion?: (value: string) => void;
	dbCpu?: string;
	setDbCpu?: (value: string) => void;
	dbMemory?: string;
	setDbMemory?: (value: string) => void;
}

export function StepResources({
	cpuLimit,
	setCpuLimit,
	memoryLimitMb,
	setMemoryLimitMb,
}: StepResourcesProps) {
	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-base font-semibold text-zinc-100">Application resources</h3>
				<p className="mt-1 text-xs text-zinc-400">
					Configure compute limits for this project. Managed databases are created separately from the Databases page.
				</p>
			</div>
			<div className="grid gap-4 text-xs sm:grid-cols-2">
				<div className="grid gap-1.5">
					<label htmlFor="cpuLimit" className="font-semibold text-zinc-400">Maximum CPU cores</label>
					<Input id="cpuLimit" type="number" min="0.1" step="0.1" placeholder="Leave blank for unlimited" value={cpuLimit} onChange={(event) => setCpuLimit(event.target.value)} className="h-9 border-[#222227] bg-[#141418] font-mono text-zinc-200 focus:border-amber-500" />
				</div>
				<div className="grid gap-1.5">
					<label htmlFor="memoryLimitMb" className="font-semibold text-zinc-400">Maximum RAM (MB)</label>
					<Input id="memoryLimitMb" type="number" min="64" placeholder="Leave blank for unlimited" value={memoryLimitMb} onChange={(event) => setMemoryLimitMb(event.target.value)} className="h-9 border-[#222227] bg-[#141418] font-mono text-zinc-200 focus:border-amber-500" />
				</div>
			</div>
		</div>
	);
}
