import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";

interface RedisListViewerProps {
	items: string[];
	onPushItem: (value: string, side: "RPUSH" | "LPUSH") => Promise<void>;
	onDeleteItem: (value: string) => Promise<void>;
}

export function RedisListViewer({ items, onPushItem, onDeleteItem }: RedisListViewerProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [val, setVal] = useState("");
	const [side, setSide] = useState<"RPUSH" | "LPUSH">("RPUSH");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handlePush = async () => {
		if (!val.trim()) return;
		setIsSubmitting(true);
		try {
			await onPushItem(val, side);
			setVal("");
			setShowAdd(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground font-mono">{items.length} Items</span>
				<Button
					size="sm"
					onClick={() => setShowAdd(!showAdd)}
					className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white"
				>
					<Plus className="h-3 w-3 mr-1" /> Push Item
				</Button>
			</div>

			{showAdd && (
				<div className="p-3 bg-black/40 border border-border/60 rounded-xl space-y-2">
					<div className="flex gap-2">
						<select
							value={side}
							onChange={(e) => setSide(e.target.value as any)}
							className="bg-black/50 border border-border/60 rounded-lg px-2 text-xs font-mono text-foreground"
						>
							<option value="RPUSH">RPUSH (Append tail)</option>
							<option value="LPUSH">LPUSH (Prepend head)</option>
						</select>
						<Input
							placeholder="Value to push"
							value={val}
							onChange={(e) => setVal(e.target.value)}
							className="text-xs font-mono h-8 bg-black/50 flex-1"
							autoFocus
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={handlePush}
							disabled={isSubmitting || !val.trim()}
							className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white"
						>
							Push
						</Button>
					</div>
				</div>
			)}

			<div className="border border-border/40 rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto divide-y divide-border/20">
				{items.length === 0 ? (
					<div className="p-6 text-center text-muted-foreground font-mono text-xs italic">No items in list</div>
				) : (
					items.map((v, idx) => (
						<div key={idx} className="p-2.5 flex items-center justify-between hover:bg-white/5 font-mono text-xs">
							<span className="text-sky-400 w-12 shrink-0">#{idx}</span>
							<span className="flex-1 text-foreground/90 break-all px-2">{v}</span>
							<button
								type="button"
								onClick={() => onDeleteItem(v)}
								className="text-muted-foreground hover:text-red-400 p-1 rounded transition-colors"
								title="Remove first matching item"
							>
								<Trash2 className="h-3 w-3" />
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
}

interface RedisSetViewerProps {
	members: string[];
	onAddMember: (member: string) => Promise<void>;
	onDeleteMember: (member: string) => Promise<void>;
}

export function RedisSetViewer({ members, onAddMember, onDeleteMember }: RedisSetViewerProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [val, setVal] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleAdd = async () => {
		if (!val.trim()) return;
		setIsSubmitting(true);
		try {
			await onAddMember(val.trim());
			setVal("");
			setShowAdd(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground font-mono">{members.length} Members</span>
				<Button
					size="sm"
					onClick={() => setShowAdd(!showAdd)}
					className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
				>
					<Plus className="h-3 w-3 mr-1" /> Add Member
				</Button>
			</div>

			{showAdd && (
				<div className="p-3 bg-black/40 border border-border/60 rounded-xl flex gap-2">
					<Input
						placeholder="New unique member"
						value={val}
						onChange={(e) => setVal(e.target.value)}
						className="text-xs font-mono h-8 bg-black/50 flex-1"
						autoFocus
					/>
					<Button
						size="sm"
						onClick={handleAdd}
						disabled={isSubmitting || !val.trim()}
						className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
					>
						Add
					</Button>
				</div>
			)}

			<div className="flex flex-wrap gap-2 max-h-[420px] overflow-y-auto p-1">
				{members.length === 0 ? (
					<div className="p-6 text-center text-muted-foreground font-mono text-xs italic w-full">No members in set</div>
				) : (
					members.map((m) => (
						<div
							key={m}
							className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 border border-purple-500/30 rounded-xl font-mono text-xs text-purple-200"
						>
							<span className="break-all">{m}</span>
							<button
								type="button"
								onClick={() => handleDeleteMember(m)}
								className="text-muted-foreground hover:text-red-400 transition-colors"
								title="Remove member"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
}

interface RedisZsetViewerProps {
	members: { member: string; score: string }[];
	onAddMember: (member: string, score: number) => Promise<void>;
	onDeleteMember: (member: string) => Promise<void>;
}

export function RedisZsetViewer({ members, onAddMember, onDeleteMember }: RedisZsetViewerProps) {
	const [showAdd, setShowAdd] = useState(false);
	const [member, setMember] = useState("");
	const [score, setScore] = useState("1");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleAdd = async () => {
		if (!member.trim()) return;
		setIsSubmitting(true);
		try {
			await onAddMember(member.trim(), Number(score) || 0);
			setMember("");
			setScore("1");
			setShowAdd(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground font-mono">{members.length} Members</span>
				<Button
					size="sm"
					onClick={() => setShowAdd(!showAdd)}
					className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
				>
					<Plus className="h-3 w-3 mr-1" /> Add Member
				</Button>
			</div>

			{showAdd && (
				<div className="p-3 bg-black/40 border border-border/60 rounded-xl space-y-2">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
						<Input
							placeholder="Score (e.g. 100)"
							type="number"
							value={score}
							onChange={(e) => setScore(e.target.value)}
							className="text-xs font-mono h-8 bg-black/50"
						/>
						<Input
							placeholder="Member"
							value={member}
							onChange={(e) => setMember(e.target.value)}
							className="text-xs font-mono h-8 bg-black/50"
							autoFocus
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="h-7 text-xs">
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={handleAdd}
							disabled={isSubmitting || !member.trim()}
							className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
						>
							Add Member
						</Button>
					</div>
				</div>
			)}

			<div className="border border-border/40 rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto">
				<table className="w-full text-xs font-mono">
					<thead className="bg-black/40 border-b border-border/40 text-muted-foreground">
						<tr>
							<th className="p-2.5 text-left font-semibold w-24">Score</th>
							<th className="p-2.5 text-left font-semibold">Member</th>
							<th className="p-2.5 text-right font-semibold w-16">Action</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border/20">
						{members.length === 0 ? (
							<tr>
								<td colSpan={3} className="p-6 text-center text-muted-foreground italic">
									No members in sorted set
								</td>
							</tr>
						) : (
							members.map((entry) => (
								<tr key={entry.member} className="hover:bg-white/5 transition-colors">
									<td className="p-2.5 font-bold text-amber-400">{entry.score}</td>
									<td className="p-2.5 text-foreground/90 break-all">{entry.member}</td>
									<td className="p-2.5 text-right">
										<button
											type="button"
											onClick={() => onDeleteMember(entry.member)}
											className="text-muted-foreground hover:text-red-400 p-1 rounded transition-colors"
											title="Delete member"
										>
											<Trash2 className="h-3 w-3" />
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
