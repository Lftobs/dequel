import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../ui/button";

interface DiffViewerProps {
	diff: string;
	title?: string;
}

export function DiffViewer({ diff, title = "Suggested Fix" }: DiffViewerProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(diff);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const lines = diff.split("\n");

	return (
		<div className="rounded-xl border border-border/80 bg-zinc-950 overflow-hidden shadow-lg">
			<div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/80">
				<span className="text-xs font-mono font-medium text-zinc-300">{title}</span>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={handleCopy}
					className="h-6 text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1 px-2"
				>
					{copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
					{copied ? "Copied" : "Copy Diff"}
				</Button>
			</div>
			<div className="max-h-64 overflow-x-auto overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
				{lines.map((line, idx) => {
					let lineClass = "text-zinc-400";
					if (line.startsWith("+") && !line.startsWith("+++")) {
						lineClass = "bg-emerald-950/40 text-emerald-300 px-1 rounded-sm";
					} else if (line.startsWith("-") && !line.startsWith("---")) {
						lineClass = "bg-red-950/40 text-red-300 px-1 rounded-sm";
					} else if (line.startsWith("@@")) {
						lineClass = "text-cyan-400 font-semibold";
					} else if (
						line.startsWith("diff ") ||
						line.startsWith("index ") ||
						line.startsWith("---") ||
						line.startsWith("+++")
					) {
						lineClass = "text-zinc-500 font-medium";
					}

					return (
						<div key={idx} className={`${lineClass} whitespace-pre`}>
							{line || " "}
						</div>
					);
				})}
			</div>
		</div>
	);
}
