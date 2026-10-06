import { useQuery } from "@tanstack/react-query";
import { Key, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../../../api/client";
import type { Database } from "../../../../types";
import { RedisCliView } from "./RedisCliView";
import { RedisKeyExplorer } from "./RedisKeyExplorer";
import { RedisKeysSidebar } from "./RedisKeysSidebar";
import { RedisNewKeyDialog } from "./RedisNewKeyDialog";

interface RedisStudioProps {
	database: Database;
}

const escapeRedisArg = (str: string) => `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function RedisStudio({ database }: RedisStudioProps) {
	const [activeTab, setActiveTab] = useState<"explorer" | "cli">("explorer");
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [pattern, setPattern] = useState("");
	const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);

	const {
		data: allKeys = [],
		refetch: refetchKeys,
		isLoading: isLoadingKeys,
	} = useQuery({
		queryKey: ["redis-keys", database.id],
		queryFn: async () => {
			const res = await api.getDatabaseTables(database.id).catch(() => []);
			return res;
		},
	});

	useEffect(() => {
		if (allKeys.length > 0 && !selectedKey) {
			setSelectedKey(allKeys[0].name);
		}
	}, [allKeys, selectedKey]);

	const filteredKeys = allKeys.filter((k) => {
		if (!pattern.trim()) return true;
		const pat = pattern.trim().toLowerCase();
		if (pat === "*") return true;
		return k.name.toLowerCase().includes(pat);
	});

	const handleCreateKey = async (
		key: string,
		type: string,
		value: string,
		extra?: { field?: string; score?: string },
		ttl?: number,
	) => {
		let cmd = "";
		const escKey = escapeRedisArg(key);
		const escVal = escapeRedisArg(value);

		switch (type) {
			case "hash": {
				const field = extra?.field || "field";
				cmd = `HSET ${escKey} ${escapeRedisArg(field)} ${escVal}`;
				break;
			}
			case "list":
				cmd = `RPUSH ${escKey} ${escVal}`;
				break;
			case "set":
				cmd = `SADD ${escKey} ${escVal}`;
				break;
			case "zset": {
				const score = Number(extra?.score) || 1;
				cmd = `ZADD ${escKey} ${score} ${escVal}`;
				break;
			}
			case "string":
			default:
				cmd = `SET ${escKey} ${escVal}`;
				break;
		}

		if (ttl && ttl > 0) {
			cmd += `\nEXPIRE ${escKey} ${ttl}`;
		}

		await api.queryDatabase(database.id, cmd);
		await refetchKeys();
		setSelectedKey(key);
		setActiveTab("explorer");
	};

	const handleKeyDeleted = async (key: string) => {
		await refetchKeys();
		if (selectedKey === key) {
			const remaining = allKeys.filter((k) => k.name !== key);
			setSelectedKey(remaining[0]?.name ?? null);
		}
	};

	const handleKeyRenamed = async (oldKey: string, newKey: string) => {
		await refetchKeys();
		setSelectedKey(newKey);
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
			{/* Left Sidebar Key Explorer */}
			<RedisKeysSidebar
				keys={filteredKeys}
				selectedKey={selectedKey}
				onSelectKey={(k) => {
					setSelectedKey(k);
					setActiveTab("explorer");
				}}
				onRefresh={refetchKeys}
				onOpenNewKeyModal={() => setIsNewKeyModalOpen(true)}
				isLoading={isLoadingKeys}
				pattern={pattern}
				onPatternChange={setPattern}
				onScan={refetchKeys}
			/>

			{/* Main Studio Viewport */}
			<div className="lg:col-span-3 space-y-4">
				{/* Top Mode Navigation Tabs */}
				<div className="border border-border/60 bg-card/60 rounded-3xl p-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md shadow-xl">
					<div className="flex items-center gap-1 bg-black/50 p-1 rounded-full border border-border/40">
						<button
							type="button"
							onClick={() => setActiveTab("explorer")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
								activeTab === "explorer"
									? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<Key className="h-3.5 w-3.5" /> KEY EXPLORER
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("cli")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
								activeTab === "cli"
									? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<Terminal className="h-3.5 w-3.5" /> REDIS CLI
						</button>
					</div>

					<div className="text-xs text-muted-foreground font-mono px-3">
						Active Key: <span className="font-bold text-foreground">{selectedKey || "None"}</span>
					</div>
				</div>

				{/* Active Sub-View */}
				{activeTab === "explorer" && (
					<RedisKeyExplorer
						databaseId={database.id}
						selectedKey={selectedKey}
						onKeyDeleted={handleKeyDeleted}
						onKeyRenamed={handleKeyRenamed}
					/>
				)}

				{activeTab === "cli" && <RedisCliView databaseId={database.id} />}
			</div>

			{/* New Key Creation Dialog */}
			<RedisNewKeyDialog open={isNewKeyModalOpen} onOpenChange={setIsNewKeyModalOpen} onCreateKey={handleCreateKey} />
		</div>
	);
}
