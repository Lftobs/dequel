import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type { DatabaseType } from "../../types";
import { getDatabaseLogo } from "../logos/DatabaseLogos";

export interface DatabaseEngineInfo {
	type: DatabaseType;
	name: string;
	defaultVersion: string;
	description: string;
}

export const DATABASE_ENGINES: DatabaseEngineInfo[] = [
	{
		type: "postgresql",
		name: "PostgreSQL",
		defaultVersion: "16",
		description: "Enterprise relational database with JSONB & ACID compliance",
	},
	{
		type: "mysql",
		name: "MySQL",
		defaultVersion: "8.4",
		description: "Popular open-source relational database",
	},
	{
		type: "redis",
		name: "Redis",
		defaultVersion: "7.4",
		description: "Ultra-fast in-memory key-value data store & pub/sub cache",
	},
	{
		type: "mongodb",
		name: "MongoDB",
		defaultVersion: "7.0",
		description: "Scalable document-oriented NoSQL database",
	},
	{
		type: "mariadb",
		name: "MariaDB",
		defaultVersion: "11.4",
		description: "Community-developed relational database fork of MySQL",
	},
];

interface DatabaseSelectProps {
	value: DatabaseType;
	onValueChange: (value: DatabaseType) => void;
	className?: string;
	id?: string;
}

export function DatabaseSelect({ value, onValueChange, className, id }: DatabaseSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const selectedEngine = DATABASE_ENGINES.find((e) => e.type === value) || DATABASE_ENGINES[0];

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	return (
		<div className={cn("relative w-full", className)} ref={containerRef}>
			<button
				type="button"
				id={id}
				onClick={() => setIsOpen(!isOpen)}
				className={cn(
					"w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl",
					"bg-[#121215] border border-[#22222a] hover:border-amber-500/40 transition-all text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20",
					isOpen && "border-amber-500/60 ring-2 ring-amber-500/20 bg-[#16161c]",
				)}
			>
				<div className="flex items-center gap-2.5 min-w-0">
					<div className="p-1.5 rounded-lg bg-[#1a1a22] border border-[#2a2a36] shrink-0 flex items-center justify-center">
						{getDatabaseLogo(selectedEngine.type, "h-4 w-4")}
					</div>
					<div className="min-w-0 flex items-center gap-2">
						<span className="font-semibold text-xs text-zinc-100 truncate">{selectedEngine.name}</span>
						<span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/50">
							v{selectedEngine.defaultVersion}
						</span>
					</div>
				</div>
				<ChevronDown
					className={cn(
						"h-4 w-4 text-zinc-400 transition-transform shrink-0",
						isOpen && "transform rotate-180 text-amber-400",
					)}
				/>
			</button>

			{isOpen && (
				<div className="absolute z-50 left-0 right-0 mt-2 rounded-xl bg-[#121215] border border-[#24242e] shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-xl animate-in fade-in-50 zoom-in-95">
					<div className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
						{DATABASE_ENGINES.map((engine) => {
							const isSelected = engine.type === value;
							return (
								<button
									key={engine.type}
									type="button"
									onClick={() => {
										onValueChange(engine.type);
										setIsOpen(false);
									}}
									className={cn(
										"w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all group",
										isSelected
											? "bg-amber-500/10 border border-amber-500/30 text-zinc-100"
											: "hover:bg-[#1c1c24] text-zinc-300 border border-transparent",
									)}
								>
									<div className="flex items-center gap-3 min-w-0">
										<div
											className={cn(
												"p-2 rounded-lg shrink-0 flex items-center justify-center transition-colors",
												isSelected
													? "bg-amber-500/20 border border-amber-500/30"
													: "bg-[#181820] group-hover:bg-[#22222d]",
											)}
										>
											{getDatabaseLogo(engine.type, "h-4 w-4")}
										</div>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<span
													className={cn(
														"font-semibold text-xs truncate",
														isSelected ? "text-amber-400 font-bold" : "text-zinc-200 group-hover:text-white",
													)}
												>
													{engine.name}
												</span>
												<span className="text-[10px] text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded border border-zinc-700/30">
													v{engine.defaultVersion}
												</span>
											</div>
											<p className="text-[11px] text-zinc-400 truncate mt-0.5">{engine.description}</p>
										</div>
									</div>
									{isSelected && <Check className="h-4 w-4 text-amber-400 shrink-0 ml-2" />}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
