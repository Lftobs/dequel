import { Activity, Check, Copy, Cpu, Database, HardDrive, RefreshCw, Server, Users } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../../../api/client";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";

interface RedisServerInfoViewProps {
	databaseId: string;
}

interface ParsedRedisInfo {
	sections: Record<string, Record<string, string>>;
	raw: string;
}

export function RedisServerInfoView({ databaseId }: RedisServerInfoViewProps) {
	const [info, setInfo] = useState<ParsedRedisInfo | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [activeSection, setActiveSection] = useState<string>("Server");
	const [copied, setCopied] = useState(false);

	const loadInfo = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const res = await api.queryDatabase(databaseId, "INFO");
			const raw = res.rawOutput || (res.rows || []).map((r) => `${r.result ?? ""}`).join("\n");

			const sections: Record<string, Record<string, string>> = {};
			let currentSection = "General";

			const lines = raw.split("\n");
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				if (trimmed.startsWith("#")) {
					currentSection = trimmed.replace(/^#\s*/, "").trim();
					if (!sections[currentSection]) {
						sections[currentSection] = {};
					}
				} else if (trimmed.includes(":")) {
					const [key, ...rest] = trimmed.split(":");
					const val = rest.join(":");
					if (!sections[currentSection]) {
						sections[currentSection] = {};
					}
					sections[currentSection][key.trim()] = val.trim();
				}
			}

			setInfo({ sections, raw });
			const sectionKeys = Object.keys(sections);
			if (sectionKeys.length > 0 && !sections[activeSection]) {
				setActiveSection(sectionKeys[0]);
			}
		} catch (err: any) {
			setError(err.message || "Failed to load Redis server info");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		loadInfo();
	}, [databaseId]);

	const copyRaw = () => {
		if (!info?.raw) return;
		navigator.clipboard.writeText(info.raw);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	const getValue = (section: string, key: string, fallback = "-") => {
		return info?.sections[section]?.[key] ?? fallback;
	};

	const getKeysCount = () => {
		const keyspace = info?.sections.Keyspace;
		if (!keyspace) return "0";
		let total = 0;
		for (const val of Object.values(keyspace)) {
			const match = val.match(/keys=(\d+)/);
			if (match) total += Number(match[1]);
		}
		return String(total);
	};

	return (
		<div className="space-y-6">
			{/* Overview Metric Cards */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
				<div className="border border-border/60 bg-card/60 rounded-2xl p-3.5 backdrop-blur-md shadow-md space-y-1">
					<div className="flex items-center justify-between text-muted-foreground">
						<span className="text-[11px] font-medium uppercase tracking-wider">Version</span>
						<Server className="h-3.5 w-3.5 text-orange-400" />
					</div>
					<div className="text-base font-bold font-mono text-foreground truncate">
						{getValue("Server", "redis_version")}
					</div>
					<div className="text-[10px] text-muted-foreground font-mono">Mode: {getValue("Server", "redis_mode")}</div>
				</div>

				<div className="border border-border/60 bg-card/60 rounded-2xl p-3.5 backdrop-blur-md shadow-md space-y-1">
					<div className="flex items-center justify-between text-muted-foreground">
						<span className="text-[11px] font-medium uppercase tracking-wider">Memory</span>
						<HardDrive className="h-3.5 w-3.5 text-emerald-400" />
					</div>
					<div className="text-base font-bold font-mono text-emerald-400 truncate">
						{getValue("Memory", "used_memory_human")}
					</div>
					<div className="text-[10px] text-muted-foreground font-mono">
						Peak: {getValue("Memory", "used_memory_peak_human")}
					</div>
				</div>

				<div className="border border-border/60 bg-card/60 rounded-2xl p-3.5 backdrop-blur-md shadow-md space-y-1">
					<div className="flex items-center justify-between text-muted-foreground">
						<span className="text-[11px] font-medium uppercase tracking-wider">Clients</span>
						<Users className="h-3.5 w-3.5 text-sky-400" />
					</div>
					<div className="text-base font-bold font-mono text-foreground truncate">
						{getValue("Clients", "connected_clients")}
					</div>
					<div className="text-[10px] text-muted-foreground font-mono">Max: {getValue("Clients", "maxclients")}</div>
				</div>

				<div className="border border-border/60 bg-card/60 rounded-2xl p-3.5 backdrop-blur-md shadow-md space-y-1">
					<div className="flex items-center justify-between text-muted-foreground">
						<span className="text-[11px] font-medium uppercase tracking-wider">Total Keys</span>
						<Database className="h-3.5 w-3.5 text-purple-400" />
					</div>
					<div className="text-base font-bold font-mono text-purple-400 truncate">{getKeysCount()}</div>
					<div className="text-[10px] text-muted-foreground font-mono">
						Hits: {getValue("Stats", "keyspace_hits", "0")}
					</div>
				</div>

				<div className="border border-border/60 bg-card/60 rounded-2xl p-3.5 backdrop-blur-md shadow-md space-y-1">
					<div className="flex items-center justify-between text-muted-foreground">
						<span className="text-[11px] font-medium uppercase tracking-wider">Uptime</span>
						<Activity className="h-3.5 w-3.5 text-amber-400" />
					</div>
					<div className="text-base font-bold font-mono text-foreground truncate">
						{getValue("Server", "uptime_in_days")}d
					</div>
					<div className="text-[10px] text-muted-foreground font-mono">
						{getValue("Server", "uptime_in_seconds")}s total
					</div>
				</div>

				<div className="border border-border/60 bg-card/60 rounded-2xl p-3.5 backdrop-blur-md shadow-md space-y-1">
					<div className="flex items-center justify-between text-muted-foreground">
						<span className="text-[11px] font-medium uppercase tracking-wider">Ops / Sec</span>
						<Cpu className="h-3.5 w-3.5 text-rose-400" />
					</div>
					<div className="text-base font-bold font-mono text-foreground truncate">
						{getValue("Stats", "instantaneous_ops_per_sec", "0")}
					</div>
					<div className="text-[10px] text-muted-foreground font-mono">
						Total: {getValue("Stats", "total_commands_processed", "0")}
					</div>
				</div>
			</div>

			{/* Section Viewer Container */}
			<div className="border border-border/60 bg-card/60 rounded-3xl backdrop-blur-md shadow-xl overflow-hidden">
				<div className="p-4 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 bg-card/40">
					<div className="flex items-center gap-1.5 overflow-x-auto py-1">
						{info &&
							Object.keys(info.sections).map((sec) => (
								<button
									key={sec}
									type="button"
									onClick={() => setActiveSection(sec)}
									className={`px-3 py-1 text-xs font-mono rounded-xl transition-all ${
										activeSection === sec
											? "bg-orange-500/20 text-orange-400 border border-orange-500/40 font-semibold"
											: "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
									}`}
								>
									{sec}
								</button>
							))}
						<button
							type="button"
							onClick={() => setActiveSection("RAW")}
							className={`px-3 py-1 text-xs font-mono rounded-xl transition-all ${
								activeSection === "RAW"
									? "bg-orange-500/20 text-orange-400 border border-orange-500/40 font-semibold"
									: "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
							}`}
						>
							Raw Output
						</button>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={copyRaw}
							className="h-8 text-xs text-muted-foreground hover:text-foreground"
							title="Copy Raw Info"
						>
							{copied ? <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
							Copy Info
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={loadInfo}
							disabled={isLoading}
							className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
							title="Refresh Info"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
						</Button>
					</div>
				</div>

				{error && (
					<div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs font-mono">{error}</div>
				)}

				<div className="p-5">
					{activeSection === "RAW" ? (
						<pre className="p-4 bg-black/60 border border-border/40 rounded-2xl font-mono text-xs text-foreground/90 whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed">
							{info?.raw || "(no output)"}
						</pre>
					) : (
						<div className="border border-border/40 rounded-2xl overflow-hidden max-h-[460px] overflow-y-auto">
							<table className="w-full text-xs font-mono">
								<thead className="bg-black/50 border-b border-border/40 text-muted-foreground">
									<tr>
										<th className="p-2.5 text-left font-semibold w-1/3">Property</th>
										<th className="p-2.5 text-left font-semibold">Value</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/20">
									{info?.sections[activeSection] &&
										Object.entries(info.sections[activeSection]).map(([k, v]) => (
											<tr key={k} className="hover:bg-white/5 transition-colors">
												<td className="p-2.5 font-semibold text-orange-300 break-all">{k}</td>
												<td className="p-2.5 text-foreground/90 break-all">{v}</td>
											</tr>
										))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
