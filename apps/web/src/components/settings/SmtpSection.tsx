import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Mail, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

const SMTP_PRESETS = [
	{ name: "Resend", host: "smtp.resend.com", port: "587" },
	{ name: "SendGrid", host: "smtp.sendgrid.net", port: "587" },
	{ name: "Postmark", host: "smtp.postmarkapp.com", port: "587" },
	{ name: "Mailgun", host: "smtp.mailgun.org", port: "587" },
	{ name: "AWS SES", host: "email-smtp.us-east-1.amazonaws.com", port: "587" },
];

export function SmtpSection() {
	const { data, refetch } = useQuery({
		queryKey: ["smtp-settings"],
		queryFn: () => api.getSmtpSettings(),
	});
	const [host, setHost] = useState("");
	const [port, setPort] = useState("587");
	const [user, setUser] = useState("");
	const [pass, setPass] = useState("");
	const [fromAddress, setFromAddress] = useState("");
	const [showPass, setShowPass] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<string | null>(null);
	const [saveResult, setSaveResult] = useState<string | null>(null);

	useEffect(() => {
		if (data?.configured) {
			setHost(data.host || "");
			setPort(String(data.port || 587));
			setUser(data.user || "");
			setFromAddress(data.fromAddress || "");
		}
	}, [data]);

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaveResult(null);
		try {
			await api.setSmtpSettings({ host: host.trim(), port: Number(port), user, pass, fromAddress });
			setPass("");
			refetch();
			setSaveResult("SMTP settings saved successfully.");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			setSaveResult(`error: ${message}`);
		}
	};

	const test = async () => {
		setTestResult(null);
		setTesting(true);
		try {
			await api.testSmtpSettings();
			setTestResult("Test email sent successfully.");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			setTestResult(`error: ${message}`);
		} finally {
			setTesting(false);
		}
	};

	const applyPreset = (presetHost: string, presetPort: string) => {
		setHost(presetHost);
		setPort(presetPort);
	};

	return (
		<Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl overflow-hidden">
			<CardHeader className="border-b border-border/40 pb-5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20 shrink-0">
							<Mail className="h-5 w-5" />
						</div>
						<div>
							<div className="flex items-center gap-2 flex-wrap">
								<CardTitle className="text-lg font-semibold text-foreground">SMTP Email Notifications</CardTitle>
								{data?.configured ? (
									<Badge
										variant="success"
										className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 text-[10px]"
									>
										<ShieldCheck className="h-3 w-3" /> Active
									</Badge>
								) : (
									<Badge variant="warning" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
										Not Configured
									</Badge>
								)}
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								Configure outbound mail servers for deployment alerts, system notices, and password resets.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 self-start sm:self-auto">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={test}
							disabled={!data?.configured || testing}
							className="text-xs border-border/60 hover:bg-orange-500/10 hover:text-orange-400 gap-1.5"
						>
							{testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
							{testing ? "Sending..." : "Test Email"}
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent className="pt-6 space-y-6">
				<div className="space-y-2">
					<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
						Quick Provider Presets
					</span>
					<div className="flex flex-wrap gap-2">
						{SMTP_PRESETS.map((preset) => (
							<button
								key={preset.name}
								type="button"
								onClick={() => applyPreset(preset.host, preset.port)}
								className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
									host === preset.host
										? "border-orange-500/60 bg-orange-500/10 text-orange-400 shadow-sm"
										: "border-border/60 bg-card/40 text-muted-foreground hover:bg-card hover:text-foreground"
								}`}
							>
								{preset.name}
							</button>
						))}
					</div>
				</div>

				<form onSubmit={save} className="space-y-4">
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
						<div className="space-y-1.5 md:col-span-2">
							<label className="text-xs font-medium text-foreground">SMTP Server Host</label>
							<Input
								placeholder="smtp.example.com"
								value={host}
								onChange={(e) => setHost(e.target.value)}
								className="bg-card border-border/80 text-xs font-mono focus:ring-orange-500/50"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">Port</label>
							<Input
								type="number"
								value={port}
								onChange={(e) => setPort(e.target.value)}
								className="bg-card border-border/80 text-xs font-mono focus:ring-orange-500/50"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">SMTP Username</label>
							<Input
								placeholder="user@domain.com"
								value={user}
								onChange={(e) => setUser(e.target.value)}
								className="bg-card border-border/80 text-xs focus:ring-orange-500/50"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">SMTP Password</label>
							<div className="relative flex items-center">
								<Input
									type={showPass ? "text" : "password"}
									placeholder={data?.configured ? "(unchanged)" : "Enter password..."}
									value={pass}
									onChange={(e) => setPass(e.target.value)}
									className="bg-card border-border/80 text-xs font-mono focus:ring-orange-500/50 pr-10"
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={() => setShowPass(!showPass)}
									className="absolute right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
								>
									{showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
								</Button>
							</div>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">From Email Address</label>
							<Input
								placeholder="dequel@example.com"
								value={fromAddress}
								onChange={(e) => setFromAddress(e.target.value)}
								className="bg-card border-border/80 text-xs focus:ring-orange-500/50"
							/>
						</div>
					</div>

					<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
						<div className="space-y-1">
							{saveResult && (
								<p
									className={`text-xs font-medium ${saveResult.startsWith("error") ? "text-red-400" : "text-emerald-400"}`}
								>
									{saveResult}
								</p>
							)}
							{testResult && (
								<p
									className={`text-xs font-medium ${testResult.startsWith("error") ? "text-red-400" : "text-emerald-400"}`}
								>
									{testResult}
								</p>
							)}
						</div>

						<Button
							type="submit"
							size="sm"
							className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs px-5 shadow-md w-full sm:w-auto"
						>
							Save SMTP Settings
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
