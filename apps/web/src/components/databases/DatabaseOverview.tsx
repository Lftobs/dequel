import { Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { Database } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

interface DatabaseOverviewProps {
	database: Database;
	creds: { internalConnectionString?: string; externalConnectionString?: string } | null;
}

export function DatabaseOverview({ database, creds }: DatabaseOverviewProps) {
	const [showPassword, setShowPassword] = useState(false);
	const [copied, setCopied] = useState<string | null>(null);

	const copyToClipboard = (text: string, label: string) => {
		navigator.clipboard.writeText(text);
		setCopied(label);
		setTimeout(() => setCopied(null), 2000);
	};

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl p-6 space-y-6">
			<CardHeader className="p-0 border-b border-border/40 pb-4">
				<CardTitle className="text-base font-bold text-foreground">Connection Strings & Credentials</CardTitle>
				<CardDescription className="text-xs text-muted-foreground">
					Use internal mesh URL inside Dequel project containers, or external endpoint for remote clients.
				</CardDescription>
			</CardHeader>

			<CardContent className="p-0 space-y-6">
				<div className="space-y-3">
					<label className="text-xs font-bold text-foreground uppercase tracking-wider">
						Internal Connection String
					</label>
					<div className="flex items-center gap-2">
						<Input
							readOnly
							value={creds?.internalConnectionString || database.connectionString}
							className="bg-black/40 border-border/60 font-mono text-xs text-orange-400 rounded-xl h-10"
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={() => copyToClipboard(creds?.internalConnectionString || database.connectionString, "internal")}
							className="h-10 px-3 rounded-xl border-border/60 text-xs gap-1.5"
						>
							<Copy className="h-3.5 w-3.5" />
							{copied === "internal" ? "Copied" : "Copy"}
						</Button>
					</div>
				</div>

				{creds?.externalConnectionString && (
					<div className="space-y-3 pt-4 border-t border-border/40">
						<label className="text-xs font-bold text-foreground uppercase tracking-wider">
							External Connection String
						</label>
						<div className="flex items-center gap-2">
							<Input
								readOnly
								value={creds.externalConnectionString}
								className="bg-black/40 border-border/60 font-mono text-xs text-blue-400 rounded-xl h-10"
							/>
							<Button
								variant="outline"
								size="sm"
								onClick={() => copyToClipboard(creds.externalConnectionString!, "external")}
								className="h-10 px-3 rounded-xl border-border/60 text-xs gap-1.5"
							>
								<Copy className="h-3.5 w-3.5" />
								{copied === "external" ? "Copied" : "Copy"}
							</Button>
						</div>
					</div>
				)}

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border/40 font-mono text-xs">
					<div className="p-3 bg-black/20 rounded-xl border border-border/40">
						<span className="text-muted-foreground text-[10px] uppercase block">Username</span>
						<span className="font-bold text-foreground">{database.username}</span>
					</div>
					<div className="p-3 bg-black/20 rounded-xl border border-border/40 flex justify-between items-center">
						<div>
							<span className="text-muted-foreground text-[10px] uppercase block">Password</span>
							<span className="font-bold text-foreground">{showPassword ? database.password : "••••••••••••••••"}</span>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowPassword(!showPassword)}
							className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
						>
							{showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
						</Button>
					</div>
					<div className="p-3 bg-black/20 rounded-xl border border-border/40">
						<span className="text-muted-foreground text-[10px] uppercase block">Database Name</span>
						<span className="font-bold text-foreground">{database.databaseName}</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
