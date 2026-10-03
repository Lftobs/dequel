import { Key } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/dialog";
import { Input } from "../../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";

interface RedisNewKeyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreateKey: (
		key: string,
		type: string,
		value: string,
		extra?: { field?: string; score?: string },
		ttl?: number,
	) => Promise<void>;
}

export function RedisNewKeyDialog({ open, onOpenChange, onCreateKey }: RedisNewKeyDialogProps) {
	const [keyName, setKeyName] = useState("");
	const [keyType, setKeyType] = useState("string");
	const [value, setValue] = useState("");
	const [field, setField] = useState("");
	const [score, setScore] = useState("1");
	const [ttl, setTtl] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const reset = () => {
		setKeyName("");
		setKeyType("string");
		setValue("");
		setField("");
		setScore("1");
		setTtl("");
		setError(null);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = keyName.trim();
		if (!name) return;
		setIsSubmitting(true);
		setError(null);

		try {
			const ttlSeconds = ttl.trim() ? Number(ttl.trim()) : undefined;
			await onCreateKey(name, keyType, value, { field: field.trim(), score: score.trim() }, ttlSeconds);
			reset();
			onOpenChange(false);
		} catch (err: any) {
			setError(err.message || "Failed to create key");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md bg-card border-border/80 text-foreground rounded-2xl shadow-2xl">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle className="text-base font-semibold flex items-center gap-2">
							<Key className="h-4 w-4 text-orange-400" /> Create Redis Key
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Insert a new key-value pair, hash, list, or set into Redis.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 py-1">
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">Key Name</label>
							<Input
								value={keyName}
								onChange={(e) => setKeyName(e.target.value)}
								placeholder="e.g. user:1001, config:theme, queue:tasks"
								className="bg-card border-border/80 font-mono text-xs"
								autoFocus
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">Data Type</label>
							<Select value={keyType} onValueChange={setKeyType}>
								<SelectTrigger className="h-9 text-xs bg-card border-border/80 font-mono">
									<SelectValue placeholder="Select key type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="string">string (Text / JSON)</SelectItem>
									<SelectItem value="hash">hash (Field-Value map)</SelectItem>
									<SelectItem value="list">list (Ordered collection)</SelectItem>
									<SelectItem value="set">set (Unique members)</SelectItem>
									<SelectItem value="zset">zset (Sorted set with scores)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{keyType === "hash" && (
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Field</label>
								<Input
									value={field}
									onChange={(e) => setField(e.target.value)}
									placeholder="e.g. username, email, role"
									className="bg-card border-border/80 font-mono text-xs"
								/>
							</div>
						)}

						{keyType === "zset" && (
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-foreground">Score</label>
								<Input
									type="number"
									value={score}
									onChange={(e) => setScore(e.target.value)}
									placeholder="1"
									className="bg-card border-border/80 font-mono text-xs"
								/>
							</div>
						)}

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">
								{keyType === "string" ? "Value" : keyType === "hash" ? "Field Value" : "Initial Member / Value"}
							</label>
							<textarea
								value={value}
								onChange={(e) => setValue(e.target.value)}
								rows={keyType === "string" ? 4 : 2}
								placeholder="Enter value..."
								className="w-full bg-black/50 border border-border/80 rounded-xl p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-y"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">TTL Expiration (Seconds, optional)</label>
							<Input
								type="number"
								value={ttl}
								onChange={(e) => setTtl(e.target.value)}
								placeholder="e.g. 3600 (leave empty for persistent)"
								className="bg-card border-border/80 font-mono text-xs"
							/>
						</div>

						{error && <p className="text-xs text-red-400 font-mono">{error}</p>}
					</div>

					<DialogFooter className="gap-2 sm:gap-0 border-t border-border/40 pt-3">
						<Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
							Cancel
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={isSubmitting || !keyName.trim()}
							className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium"
						>
							{isSubmitting ? "Creating…" : "Create Key"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
