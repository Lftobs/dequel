import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "../../api/client";
import { Card, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { StatusBadge } from "../StatusBadge";
import { Trash2 } from "lucide-react";

interface DatabasesTabProps {
	projectId: string;
}

export function DatabasesTab({ projectId }: DatabasesTabProps) {
	const { data: databases = [], refetch } =
		useQuery({
			queryKey: ["databases", projectId],
			queryFn: () => api.listDatabases(projectId),
			refetchInterval: 5000,
		});

	const [dbType, setDbType] = useState<
		"postgresql" | "mysql"
	>("postgresql");
	const [dbVersion, setDbVersion] =
		useState("");
	const [dbCpu, setDbCpu] =
		useState("");
	const [dbMemory, setDbMemory] =
		useState("");

	const createDb = async () => {
		await api.createDatabase(projectId, dbType, {
			version: dbVersion.trim() || undefined,
			cpuLimit: dbCpu.trim()
				? Number(dbCpu)
				: null,
			memoryLimitMb: dbMemory.trim()
				? Number(dbMemory)
				: null,
		});
		setDbVersion("");
		setDbCpu("");
		setDbMemory("");
		refetch();
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="pt-6">
					<div className="grid gap-3">
						<div className="flex flex-wrap gap-2">
							<Button
								variant={
									dbType === "postgresql"
										? "default"
										: "outline"
								}
								onClick={() =>
									setDbType(
										"postgresql",
									)
								}
							>
								PostgreSQL
							</Button>
							<Button
								variant={
									dbType === "mysql"
										? "default"
										: "outline"
								}
								onClick={() =>
									setDbType(
										"mysql",
									)
								}
							>
								MySQL
							</Button>
						</div>
						<div className="grid gap-3 sm:grid-cols-3">
							<div className="grid gap-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									Version
								</label>
								<Input
									placeholder={
										dbType === "mysql"
											? "8.0"
											: "16-alpine"
									}
									value={dbVersion}
									onChange={(e) =>
										setDbVersion(
											e.target.value,
										)
									}
								/>
							</div>
							<div className="grid gap-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									CPU (cores)
								</label>
								<Input
									type="number"
									min={0}
									step="0.1"
									placeholder="1"
									value={dbCpu}
									onChange={(e) =>
										setDbCpu(
											e.target.value,
										)
									}
								/>
							</div>
							<div className="grid gap-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									Memory (MB)
								</label>
								<Input
									type="number"
									min={0}
									step="64"
									placeholder="512"
									value={dbMemory}
									onChange={(e) =>
										setDbMemory(
											e.target.value,
										)
									}
								/>
							</div>
						</div>
						<Button
							onClick={createDb}
							size="sm"
						>
							Provision Database
						</Button>
					</div>
				</CardContent>
			</Card>
			{databases.length > 0 && (
				<div className="rounded-xl border border-border bg-card overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									Type
								</TableHead>
								<TableHead>
									Database
								</TableHead>
								<TableHead>
									Status
								</TableHead>
								<TableHead>
									Connection
								</TableHead>
								<TableHead className="w-12"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{databases.map(
								(db) => (
									<TableRow
										key={
											db.id
										}
									>
										<TableCell>
											<Badge variant="info">
												{
													db.type
												}
											</Badge>
										</TableCell>
										<TableCell className="font-mono text-xs">
											{
												db.databaseName
											}
										</TableCell>
										<TableCell>
											<StatusBadge
												status={
													db.status
												}
											/>
										</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground max-w-[250px] truncate">
											{
												db.connectionString
											}
										</TableCell>
										<TableCell>
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-muted-foreground hover:text-destructive"
												onClick={() =>
													api
														.deleteDatabase(
															db.id,
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
								),
							)}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
