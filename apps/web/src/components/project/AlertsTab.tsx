import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Trash2 } from "lucide-react";

interface AlertsTabProps {
	projectId: string;
}

export function AlertsTab({ projectId }: AlertsTabProps) {
	const { data: alerts = [], refetch } =
		useQuery({
			queryKey: ["alerts", projectId],
			queryFn: () =>
				api.listAlerts(projectId),
		});
	const [type, setType] = useState("cpu");
	const [threshold, setThreshold] =
		useState("80");
	const [channel, setChannel] =
		useState("email");

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		await api.createAlert(projectId, {
			type,
			threshold: Number(threshold),
			channel,
		} as any);
		refetch();
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Alert Rules
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={add}
						className="flex flex-wrap gap-2 items-end"
					>
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								Type
							</label>
							<select
								value={type}
								onChange={(e) =>
									setType(
										e.target
											.value,
									)
								}
								className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm text-foreground"
							>
								<option value="cpu">
									CPU
								</option>
								<option value="memory">
									Memory
								</option>
								<option value="error_rate">
									Error Rate
								</option>
								<option value="downtime">
									Downtime
								</option>
								<option value="cert_expiry">
									Cert Expiry
								</option>
							</select>
						</div>
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								Threshold
							</label>
							<Input
								type="number"
								value={threshold}
								onChange={(e) =>
									setThreshold(
										e.target
											.value,
									)
								}
								className="w-24"
							/>
						</div>
						<div className="grid gap-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								Channel
							</label>
							<select
								value={channel}
								onChange={(e) =>
									setChannel(
										e.target
											.value,
									)
								}
								className="flex h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm text-foreground"
							>
								<option value="email">
									Email
								</option>
							</select>
						</div>
						<Button
							type="submit"
							size="sm"
						>
							Add Alert
						</Button>
					</form>
				</CardContent>
			</Card>
			{alerts.length > 0 && (
				<div className="rounded-xl border border-border bg-card overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									Type
								</TableHead>
								<TableHead>
									Threshold
								</TableHead>
								<TableHead>
									Channel
								</TableHead>
								<TableHead>
									Enabled
								</TableHead>
								<TableHead className="w-12"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{alerts.map((a) => (
								<TableRow
									key={a.id}
								>
									<TableCell>
										<Badge variant="info">
											{
												a.type
											}
										</Badge>
									</TableCell>
									<TableCell>
										{
											a.threshold
										}
									</TableCell>
									<TableCell>
										{
											a.channel
										}
									</TableCell>
									<TableCell>
										<input
											type="checkbox"
											checked={
												a.enabled
											}
											onChange={() =>
												api
													.toggleAlert(
														a.id,
														!a.enabled,
													)
													.then(
														() =>
															refetch(),
													)
											}
											className="rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
										/>
									</TableCell>
									<TableCell>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-muted-foreground hover:text-destructive"
											onClick={() =>
												api
													.deleteAlert(
														a.id,
													)
													.then(
														() =>
															refetch(),
													)
											}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
