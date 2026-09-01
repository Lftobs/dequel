import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Mail } from "lucide-react";
import * as api from "../../api/client";

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
			setSaveResult("Settings saved");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			setSaveResult("error: " + message);
		}
	};

	const test = async () => {
		setTestResult(null);
		try {
			await api.testSmtpSettings();
			setTestResult("Test email sent successfully");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			setTestResult("error: " + message);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Mail className="h-5 w-5 text-muted-foreground" />
					<CardTitle className="text-lg">SMTP Settings</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<form onSubmit={save} className="flex flex-wrap items-end gap-3 mb-4">
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">Host</label>
						<Input placeholder="smtp.example.com" value={host} onChange={(e) => setHost(e.target.value)} className="w-44" />
					</div>
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">Port</label>
						<Input type="number" value={port} onChange={(e) => setPort(e.target.value)} className="w-20" />
					</div>
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">Username</label>
						<Input placeholder="user" value={user} onChange={(e) => setUser(e.target.value)} className="w-36" />
					</div>
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">Password</label>
						<Input type="password" placeholder={data?.configured ? "(unchanged)" : ""} value={pass} onChange={(e) => setPass(e.target.value)} className="w-36" />
					</div>
					<div className="grid gap-1.5">
						<label className="text-xs font-medium text-muted-foreground">From Address</label>
						<Input placeholder="dequel@example.com" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} className="w-44" />
					</div>
					<div className="flex gap-2">
						<Button type="submit" size="sm">Save</Button>
						<Button type="button" size="sm" variant="secondary" onClick={test} disabled={!data?.configured}>Test</Button>
					</div>
				</form>
				{saveResult && (
					<p className={`text-xs ${saveResult.startsWith("error") ? "text-red-400" : "text-emerald-400"}`}>{saveResult}</p>
				)}
				{testResult && (
					<p className={`text-xs ${testResult.startsWith("error") ? "text-red-400" : "text-emerald-400"}`}>{testResult}</p>
				)}
			</CardContent>
		</Card>
	);
}
