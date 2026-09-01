import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Bot, Eye, EyeOff } from "lucide-react";
import type { AiProvider } from "../../../types";

interface ProviderConfigCardProps {
	provider: AiProvider;
	name: string;
	configured: boolean;
	iconColor: string;
	apiKey: string;
	onApiKeyChange: (key: string) => void;
	model: string;
	onModelChange: (model: string) => void;
	models: Array<{ value: string; label: string }>;
	onTest: () => void;
	isTesting: boolean;
}

export function ProviderConfigCard({
	name,
	configured,
	iconColor,
	apiKey,
	onApiKeyChange,
	model,
	onModelChange,
	models,
	onTest,
	isTesting,
}: ProviderConfigCardProps) {
	const [showKey, setShowKey] = useState(false);

	return (
		<div className="p-4 rounded-xl border border-border bg-[#0a0a0d] space-y-3">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Bot className={`h-4 w-4 ${iconColor}`} />
					<span className="text-xs font-bold text-foreground">{name} Configuration</span>
					{configured && (
						<span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 font-mono">
							Configured
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onTest}
						disabled={isTesting}
						className="h-7 text-xs px-2.5 rounded-lg border-border hover:bg-[#18181f]"
					>
						{isTesting ? "Testing..." : "Test"}
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div className="space-y-1">
					<label className="text-[11px] font-medium text-muted-foreground">
						API Key {configured && "(Leave blank to keep saved key)"}
					</label>
					<div className="relative flex items-center">
						<Input
							type={showKey ? "text" : "password"}
							placeholder={configured ? "••••••••••••••••" : "Paste API key..."}
							value={apiKey}
							onChange={(e) => onApiKeyChange(e.target.value)}
							className="h-9 text-xs bg-[#121217] border-border font-mono pr-9"
						/>
						<button
							type="button"
							onClick={() => setShowKey(!showKey)}
							className="absolute right-2.5 text-muted-foreground hover:text-foreground"
						>
							{showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
						</button>
					</div>
				</div>
				<div className="space-y-1">
					<label className="text-[11px] font-medium text-muted-foreground">
						Default Model
					</label>
					<select
						value={model}
						onChange={(e) => onModelChange(e.target.value)}
						className="h-9 w-full rounded-md border border-border bg-[#121217] px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					>
						{models.map((m) => (
							<option key={m.value} value={m.value}>{m.label}</option>
						))}
					</select>
				</div>
			</div>
		</div>
	);
}
