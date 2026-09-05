import { Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDeploymentLogs } from "../../../hooks/useDeploymentLogs";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";

export function formatTimeAgo(dateStr: string) {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

const isErrorLogLine = (message: string) => /^(CRITICAL|ERROR|Deployment failed|Rollback failed)/i.test(message);

export function parseTimestamp(raw: string) {
	if (!raw) return Date.now();
	const normalized = raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw;
	const d = new Date(normalized);
	return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
}

export function depDisplayName(projectName: string | undefined, depId: string) {
	const short = depId.slice(0, 8);
	if (!projectName) return short;
	const slug = projectName
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 63);
	return `${slug}-${short}`;
}

export function DeploymentDuration({ deployment }: { deployment: any }) {
	const [duration, setDuration] = useState("");

	useEffect(() => {
		const calculate = () => {
			const start = parseTimestamp(deployment.createdAt);
			const status = deployment.status;
			const isFinished = status !== "pending" && status !== "building" && status !== "deploying";
			const end = isFinished ? parseTimestamp(deployment.finishedAt ?? deployment.updatedAt) : Date.now();

			const diff = Math.max(0, end - start);
			const secs = Math.floor(diff / 1000);
			if (secs < 60) {
				setDuration(`${secs}s`);
			} else {
				const mins = Math.floor(secs / 60);
				const remainingSecs = secs % 60;
				setDuration(`${mins}m ${remainingSecs}s`);
			}
		};

		calculate();

		const status = deployment.status;
		const isFinished = status !== "pending" && status !== "building" && status !== "deploying";
		if (isFinished) return;

		const interval = setInterval(calculate, 1000);
		return () => clearInterval(interval);
	}, [deployment.createdAt, deployment.updatedAt, deployment.status]);

	return <span className="font-mono text-xs text-muted-foreground">{duration}</span>;
}

function fmtLogTs(raw: string | undefined) {
	if (!raw) return "";
	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) return raw;
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function DeploymentLogs({ deployment }: { deployment: any }) {
	const { logs, isLoading } = useDeploymentLogs(deployment.id);
	const endRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		endRef.current?.scrollIntoView({
			behavior: "smooth",
		});
	}, [logs]);

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm flex items-center justify-between w-full">
					<span className="flex items-center gap-2">
						<Terminal className="h-4 w-4" />
						Build Logs — {deployment.id.slice(0, 8)}
					</span>
					<span className="text-xs font-normal text-muted-foreground flex items-center gap-2 select-none">
						<span>Duration:</span>
						<DeploymentDuration deployment={deployment} />
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="text-center py-8 text-muted-foreground text-sm">Loading logs...</div>
				) : logs.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground text-sm">
						No build logs available for this deployment.
					</div>
				) : (
					<div className="log-box">
						{logs.map((log, i) => (
							<div key={i} className={`log-line ${isErrorLogLine(log.message) ? "error" : ""}`}>
								<span className="log-stage">
									[{log.stage}
									]-[
									{fmtLogTs((log as any).timestamp || log.createdAt)}]
								</span>
								<span className="log-msg">{log.message}</span>
							</div>
						))}
						<div ref={endRef} />
					</div>
				)}
			</CardContent>
		</Card>
	);
}
