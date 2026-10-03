import { Check, Clock, Copy, Edit2, Key, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../../../api/client";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { RedisListViewer, RedisSetViewer, RedisZsetViewer } from "./RedisCollectionViewer";
import { RedisRenameDialog, RedisTtlDialog } from "./RedisKeyModals";
import { RedisHashViewer, RedisStringViewer } from "./RedisScalarViewer";

interface RedisKeyExplorerProps {
	databaseId: string;
	selectedKey: string | null;
	onKeyDeleted: (key: string) => void;
	onKeyRenamed: (oldKey: string, newKey: string) => void;
}

const escapeRedisArg = (str: string) => `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function RedisKeyExplorer({ databaseId, selectedKey, onKeyDeleted, onKeyRenamed }: RedisKeyExplorerProps) {
	const [keyType, setKeyType] = useState<string>("string");
	const [ttl, setTtl] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [stringValue, setStringValue] = useState("");
	const [hashEntries, setHashEntries] = useState<{ field: string; value: string }[]>([]);
	const [listItems, setListItems] = useState<string[]>([]);
	const [setMembers, setSetMembers] = useState<string[]>([]);
	const [zsetMembers, setZsetMembers] = useState<{ member: string; score: string }[]>([]);

	const [copied, setCopied] = useState(false);
	const [isRenameOpen, setIsRenameOpen] = useState(false);
	const [isTtlOpen, setIsTtlOpen] = useState(false);

	const loadKeyDetails = async () => {
		if (!selectedKey) return;
		setIsLoading(true);
		setError(null);

		try {
			const typeRes = await api.queryDatabase(databaseId, `TYPE ${escapeRedisArg(selectedKey)}`);
			const t = typeRes.rows[0]?.result ? String(typeRes.rows[0].result).trim().toLowerCase() : "string";
			setKeyType(t);

			const ttlRes = await api.queryDatabase(databaseId, `TTL ${escapeRedisArg(selectedKey)}`);
			const ttlVal = Number(ttlRes.rows[0]?.result ?? -1);
			setTtl(ttlVal);

			if (t === "string") {
				const valRes = await api.queryDatabase(databaseId, `GET ${escapeRedisArg(selectedKey)}`);
				const val = valRes.rows[0]?.result !== undefined ? String(valRes.rows[0].result) : "";
				setStringValue(val);
			} else if (t === "hash") {
				const valRes = await api.queryDatabase(databaseId, `HGETALL ${escapeRedisArg(selectedKey)}`);
				const raw = valRes.rows[0]?.result !== undefined ? String(valRes.rows[0].result) : "";
				const lines = raw ? raw.split("\n") : [];
				const entries: { field: string; value: string }[] = [];
				for (let i = 0; i < lines.length; i += 2) {
					if (lines[i] !== undefined) {
						entries.push({ field: lines[i], value: lines[i + 1] ?? "" });
					}
				}
				setHashEntries(entries);
			} else if (t === "list") {
				const valRes = await api.queryDatabase(databaseId, `LRANGE ${escapeRedisArg(selectedKey)} 0 -1`);
				const raw = valRes.rows[0]?.result !== undefined ? String(valRes.rows[0].result) : "";
				setListItems(raw ? raw.split("\n") : []);
			} else if (t === "set") {
				const valRes = await api.queryDatabase(databaseId, `SMEMBERS ${escapeRedisArg(selectedKey)}`);
				const raw = valRes.rows[0]?.result !== undefined ? String(valRes.rows[0].result) : "";
				setSetMembers(raw ? raw.split("\n") : []);
			} else if (t === "zset") {
				const valRes = await api.queryDatabase(databaseId, `ZRANGE ${escapeRedisArg(selectedKey)} 0 -1 WITHSCORES`);
				const raw = valRes.rows[0]?.result !== undefined ? String(valRes.rows[0].result) : "";
				const lines = raw ? raw.split("\n") : [];
				const entries: { member: string; score: string }[] = [];
				for (let i = 0; i < lines.length; i += 2) {
					if (lines[i] !== undefined) {
						entries.push({ member: lines[i], score: lines[i + 1] ?? "0" });
					}
				}
				setZsetMembers(entries);
			}
		} catch (err: any) {
			setError(err.message || "Failed to load key data");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (selectedKey) {
			loadKeyDetails();
		}
	}, [selectedKey]);

	const handleSaveString = async (newVal: string) => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(databaseId, `SET ${escapeRedisArg(selectedKey)} ${escapeRedisArg(newVal)}`);
			setStringValue(newVal);
		} catch (err: any) {
			setError(err.message || "Failed to save string");
			throw err;
		}
	};

	const handleDeleteKey = async () => {
		if (!selectedKey) return;
		if (!confirm(`Are you sure you want to delete key "${selectedKey}"?`)) return;
		try {
			await api.queryDatabase(databaseId, `DEL ${escapeRedisArg(selectedKey)}`);
			onKeyDeleted(selectedKey);
		} catch (err: any) {
			setError(err.message || "Failed to delete key");
		}
	};

	const handleRenameKey = async (newKey: string) => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(databaseId, `RENAME ${escapeRedisArg(selectedKey)} ${escapeRedisArg(newKey)}`);
			onKeyRenamed(selectedKey, newKey);
		} catch (err: any) {
			setError(err.message || "Failed to rename key");
			throw err;
		}
	};

	const handleUpdateTtl = async (ttlSecs: number | null) => {
		if (!selectedKey) return;
		try {
			if (ttlSecs === null || ttlSecs <= 0) {
				await api.queryDatabase(databaseId, `PERSIST ${escapeRedisArg(selectedKey)}`);
				setTtl(-1);
			} else {
				await api.queryDatabase(databaseId, `EXPIRE ${escapeRedisArg(selectedKey)} ${ttlSecs}`);
				setTtl(ttlSecs);
			}
		} catch (err: any) {
			setError(err.message || "Failed to update TTL");
			throw err;
		}
	};

	const handleAddHashField = async (field: string, val: string) => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(
				databaseId,
				`HSET ${escapeRedisArg(selectedKey)} ${escapeRedisArg(field)} ${escapeRedisArg(val)}`,
			);
			loadKeyDetails();
		} catch (err: any) {
			setError(err.message || "Failed to add field");
			throw err;
		}
	};

	const handleDeleteHashField = async (field: string) => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(databaseId, `HDEL ${escapeRedisArg(selectedKey)} ${escapeRedisArg(field)}`);
			loadKeyDetails();
		} catch (err: any) {
			setError(err.message || "Failed to delete field");
		}
	};

	const handlePushListItem = async (val: string, side: "RPUSH" | "LPUSH") => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(databaseId, `${side} ${escapeRedisArg(selectedKey)} ${escapeRedisArg(val)}`);
			loadKeyDetails();
		} catch (err: any) {
			setError(err.message || "Failed to push item");
			throw err;
		}
	};

	const handleDeleteListItem = async (val: string) => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(databaseId, `LREM ${escapeRedisArg(selectedKey)} 1 ${escapeRedisArg(val)}`);
			loadKeyDetails();
		} catch (err: any) {
			setError(err.message || "Failed to remove item");
		}
	};

	const handleAddSetMember = async (m: string) => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(databaseId, `SADD ${escapeRedisArg(selectedKey)} ${escapeRedisArg(m)}`);
			loadKeyDetails();
		} catch (err: any) {
			setError(err.message || "Failed to add member");
			throw err;
		}
	};

	const handleDeleteSetMember = async (m: string) => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(databaseId, `SREM ${escapeRedisArg(selectedKey)} ${escapeRedisArg(m)}`);
			loadKeyDetails();
		} catch (err: any) {
			setError(err.message || "Failed to delete member");
		}
	};

	const handleAddZsetMember = async (m: string, score: number) => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(databaseId, `ZADD ${escapeRedisArg(selectedKey)} ${score} ${escapeRedisArg(m)}`);
			loadKeyDetails();
		} catch (err: any) {
			setError(err.message || "Failed to add member");
			throw err;
		}
	};

	const handleDeleteZsetMember = async (m: string) => {
		if (!selectedKey) return;
		try {
			await api.queryDatabase(databaseId, `ZREM ${escapeRedisArg(selectedKey)} ${escapeRedisArg(m)}`);
			loadKeyDetails();
		} catch (err: any) {
			setError(err.message || "Failed to delete member");
		}
	};

	const copyKeyName = () => {
		if (!selectedKey) return;
		navigator.clipboard.writeText(selectedKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	if (!selectedKey) {
		return (
			<div className="border border-border/60 bg-card/40 rounded-3xl p-12 text-center backdrop-blur-md shadow-xl flex flex-col items-center justify-center space-y-3 min-h-[380px]">
				<Key className="h-10 w-10 text-muted-foreground/40" />
				<h3 className="text-sm font-semibold text-foreground">No Key Selected</h3>
				<p className="text-xs text-muted-foreground max-w-sm">
					Select a key from the sidebar to inspect its contents, or create a new key.
				</p>
			</div>
		);
	}

	return (
		<div className="border border-border/60 bg-card/60 rounded-3xl backdrop-blur-md shadow-xl flex flex-col overflow-hidden">
			<div className="p-4 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 bg-card/40">
				<div className="flex items-center gap-2 min-w-0">
					<Key className="h-4 w-4 text-orange-400 shrink-0" />
					<span
						className="font-mono text-sm font-bold text-foreground truncate max-w-[280px] sm:max-w-md"
						title={selectedKey}
					>
						{selectedKey}
					</span>
					<button
						type="button"
						onClick={copyKeyName}
						className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
						title="Copy Key Name"
					>
						{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
					</button>
					<button
						type="button"
						onClick={() => setIsRenameOpen(true)}
						className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
						title="Rename Key"
					>
						<Edit2 className="h-3.5 w-3.5" />
					</button>
				</div>

				<div className="flex items-center gap-2">
					<Badge
						variant="outline"
						className="font-mono text-[10px] uppercase border-orange-500/30 text-orange-400 bg-orange-500/10"
					>
						{keyType}
					</Badge>
					<button
						type="button"
						onClick={() => setIsTtlOpen(true)}
						className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono border border-border/60 bg-black/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
					>
						<Clock className="h-3 w-3 text-amber-400" />
						{ttl === null ? "TTL: ..." : ttl === -1 ? "TTL: Persistent" : ttl === -2 ? "TTL: Expired" : `TTL: ${ttl}s`}
					</button>
					<Button
						variant="ghost"
						size="sm"
						onClick={loadKeyDetails}
						disabled={isLoading}
						className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
						title="Reload"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleDeleteKey}
						className="h-7 w-7 p-0 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
						title="Delete Key"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			{error && (
				<div className="p-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center gap-2">
					<ShieldAlert className="h-4 w-4 shrink-0" />
					<span>{error}</span>
				</div>
			)}

			<div className="p-5 flex-1 space-y-4">
				{keyType === "string" && <RedisStringViewer value={stringValue} onSave={handleSaveString} />}

				{keyType === "hash" && (
					<RedisHashViewer
						entries={hashEntries}
						onAddField={handleAddHashField}
						onDeleteField={handleDeleteHashField}
					/>
				)}

				{keyType === "list" && (
					<RedisListViewer items={listItems} onPushItem={handlePushListItem} onDeleteItem={handleDeleteListItem} />
				)}

				{keyType === "set" && (
					<RedisSetViewer
						members={setMembers}
						onAddMember={handleAddSetMember}
						onDeleteMember={handleDeleteSetMember}
					/>
				)}

				{keyType === "zset" && (
					<RedisZsetViewer
						members={zsetMembers}
						onAddMember={handleAddZsetMember}
						onDeleteMember={handleDeleteZsetMember}
					/>
				)}
			</div>

			<RedisRenameDialog
				open={isRenameOpen}
				onOpenChange={setIsRenameOpen}
				currentKey={selectedKey}
				onRename={handleRenameKey}
			/>

			<RedisTtlDialog open={isTtlOpen} onOpenChange={setIsTtlOpen} currentTtl={ttl} onUpdateTtl={handleUpdateTtl} />
		</div>
	);
}
