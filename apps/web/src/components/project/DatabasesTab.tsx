import React, {
	useState,
	useEffect,
} from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "../../api/client";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { StatusBadge } from "../StatusBadge";
import {
	Database,
	Trash2,
	Plus,
	Copy,
	Check,
	Eye,
	EyeOff,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

interface DatabasesTabProps {
	projectId: string;
}

export function DatabasesTab({
	projectId,
}: DatabasesTabProps) {
	const { data: databases = [], refetch } =
		useQuery({
			queryKey: ["databases", projectId],
			queryFn: () =>
				api.listDatabases(projectId),
			refetchInterval: 5000,
		});

	const [isProvisionOpen, setIsProvisionOpen] =
		useState(false);
	const [deletingDbId, setDeletingDbId] =
		useState<string | null>(null);

	const [dbType, setDbType] = useState<
		"postgresql" | "mysql"
	>("postgresql");
	const [dbVersion, setDbVersion] =
		useState("16-alpine");
	const [dbCpu, setDbCpu] = useState("");
	const [dbMemory, setDbMemory] = useState("");
	const [isProvisioning, setIsProvisioning] =
		useState(false);

	useEffect(() => {
		setDbVersion(
			dbType === "mysql"
				? "8.0"
				: "16-alpine",
		);
	}, [dbType]);

	const [revealDbConn, setRevealDbConn] =
		useState<Record<string, boolean>>({});
	const [copiedDbId, setCopiedDbId] = useState<
		string | null
	>(null);

	const createDb = async () => {
		setIsProvisioning(true);
		try {
			await api.createDatabase(
				projectId,
				dbType,
				{
					version:
						dbVersion.trim() ||
						undefined,
					cpuLimit: dbCpu.trim()
						? Number(dbCpu)
						: null,
					memoryLimitMb: dbMemory.trim()
						? Number(dbMemory)
						: null,
				},
			);
			setDbVersion("");
			setDbCpu("");
			setDbMemory("");
			setIsProvisionOpen(false);
			refetch();
		} finally {
			setIsProvisioning(false);
		}
	};

	const handleDeleteDb = async () => {
		if (!deletingDbId) return;
		await api.deleteDatabase(deletingDbId);
		setDeletingDbId(null);
		refetch();
	};

	const copyConnectionString = (
		id: string,
		connStr: string,
	) => {
		navigator.clipboard.writeText(connStr);
		setCopiedDbId(id);
		setTimeout(
			() => setCopiedDbId(null),
			1500,
		);
	};

	const toggleRevealDb = (id: string) => {
		setRevealDbConn((prev) => ({
			...prev,
			[id]: !prev[id],
		}));
	};

	const selectedDbToDelete = databases.find(
		(d) => d.id === deletingDbId,
	);

	return (
		<div className="space-y-6">
			{databases.length === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-12 text-center bg-card/20 backdrop-blur-sm relative overflow-hidden group min-h-[350px]">
					<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
					<div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1a1a1f] to-[#121215] border border-border flex items-center justify-center mb-6 shadow-xl group-hover:border-primary/30 transition-colors duration-300">
						<div className="absolute inset-0 bg-primary/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
						<Database className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
					</div>
					<h3 className="text-lg font-semibold text-foreground mb-2">
						No Databases Provisioned
					</h3>
					<p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
						Instantly spin up a
						dedicated PostgreSQL or
						MySQL instance configured
						and secure within your
						workspace cluster
						networks.
					</p>
					<Button
						onClick={() =>
							setIsProvisionOpen(
								true,
							)
						}
						className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-5 h-10 rounded-xl transition-all shadow-lg hover:shadow-primary/20"
					>
						<Plus className="h-4 w-4" />{" "}
						Provision Database
					</Button>
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold text-foreground">
								Managed Databases
							</h2>
							<p className="text-sm text-muted-foreground">
								Dedicated database
								instances attached
								to your service.
							</p>
						</div>
						<Button
							onClick={() =>
								setIsProvisionOpen(
									true,
								)
							}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs shadow-md"
						>
							<Plus className="h-4.5 w-4.5" />{" "}
							Provision Database
						</Button>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						{databases.map((db) => (
							<Card
								key={db.id}
								className="bg-card/45 border-border backdrop-blur-sm hover:border-border/80 transition-all flex flex-col justify-between"
							>
								<CardContent className="p-5 space-y-4">
									<div className="flex items-start justify-between">
										<div className="space-y-1.5">
											<div className="flex items-center gap-2">
												<Badge
													variant="outline"
													className="text-[10px] uppercase border-primary/20 text-primary bg-primary/5 px-2 py-0.5"
												>
													{
														db.type
													}
												</Badge>
												<StatusBadge
													status={
														db.status
													}
												/>
											</div>
											<h3 className="font-mono text-sm font-semibold text-foreground pt-1">
												{
													db.databaseName
												}
											</h3>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all shrink-0"
											onClick={() =>
												setDeletingDbId(
													db.id,
												)
											}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>

									{db.connectionString && (
										<div className="space-y-1.5">
											<label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
												Connection
												String
											</label>
											<div className="relative flex items-center bg-[#070709] border border-border/40 rounded-lg overflow-hidden p-2.5 font-mono text-[10px]">
												<span className="text-muted-foreground break-all select-all pr-12">
													{revealDbConn[
														db
															.id
													]
														? db.connectionString
														: "••••••••••••••••••••••••••••••••"}
												</span>
												<div className="absolute right-1.5 flex items-center gap-1 bg-[#070709]/90 pl-2 py-1">
													<button
														type="button"
														onClick={() =>
															toggleRevealDb(
																db.id,
															)
														}
														className="p-1 text-muted-foreground hover:text-foreground transition-colors"
														title={
															revealDbConn[
																db
																	.id
															]
																? "Hide string"
																: "Reveal string"
														}
													>
														{revealDbConn[
															db
																.id
														] ? (
															<EyeOff className="h-3.5 w-3.5" />
														) : (
															<Eye className="h-3.5 w-3.5" />
														)}
													</button>
													<button
														type="button"
														onClick={() =>
															copyConnectionString(
																db.id,
																db.connectionString,
															)
														}
														className={`p-1 transition-colors ${
															copiedDbId ===
															db.id
																? "text-emerald-400"
																: "text-muted-foreground hover:text-foreground"
														}`}
														title="Copy connection string"
													>
														{copiedDbId ===
														db.id ? (
															<Check className="h-3.5 w-3.5" />
														) : (
															<Copy className="h-3.5 w-3.5" />
														)}
													</button>
												</div>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			)}

			{/* Provision Database Dialog */}
			<Dialog
				open={isProvisionOpen}
				onOpenChange={setIsProvisionOpen}
			>
				<DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Provision Database
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Choose database engine
							type, version, and
							server capacity
							boundaries.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 pt-2">
						{/* Database Type Select buttons */}
						<div className="grid grid-cols-2 gap-2">
							{(
								[
									"postgresql",
									"mysql",
								] as const
							).map((type) => {
								const isSelected =
									dbType ===
									type;
								return (
									<button
										key={type}
										type="button"
										onClick={() =>
											setDbType(
												type,
											)
										}
										className={`p-3 rounded-xl border text-center font-semibold text-xs transition-all uppercase tracking-wider ${
											isSelected
												? "border-primary bg-primary/5 text-primary shadow-md shadow-primary/5"
												: "border-border bg-[#0d0d11] hover:border-border/80 text-muted-foreground hover:text-foreground"
										}`}
									>
										{type}
									</button>
								);
							})}
						</div>

						<div className="grid gap-2">
							<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Version
							</label>
							<Select
								value={dbVersion}
								onValueChange={
									setDbVersion
								}
							>
								<SelectTrigger className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg text-left">
									<SelectValue placeholder="Select version" />
								</SelectTrigger>
								<SelectContent className="bg-[#0c0c0e] border-border text-foreground">
									{dbType ===
									"postgresql" ? (
										<>
											<SelectItem value="16-alpine">
												16-alpine
												(Recommended)
											</SelectItem>
											<SelectItem value="15-alpine">
												15-alpine
											</SelectItem>
											<SelectItem value="14-alpine">
												14-alpine
											</SelectItem>
											<SelectItem value="13-alpine">
												13-alpine
											</SelectItem>
										</>
									) : (
										<>
											<SelectItem value="8.0">
												8.0
												(Recommended)
											</SelectItem>
											<SelectItem value="8.4">
												8.4
											</SelectItem>
											<SelectItem value="5.7">
												5.7
											</SelectItem>
										</>
									)}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="grid gap-2">
								<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									CPU Limit
									(cores)
								</label>
								<Input
									type="number"
									min={0}
									step="0.1"
									placeholder="1.0"
									value={dbCpu}
									onChange={(
										e,
									) =>
										setDbCpu(
											e
												.target
												.value,
										)
									}
									className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg"
								/>
							</div>
							<div className="grid gap-2">
								<label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									Memory Limit
									(MB)
								</label>
								<Input
									type="number"
									min={0}
									step="64"
									placeholder="512"
									value={
										dbMemory
									}
									onChange={(
										e,
									) =>
										setDbMemory(
											e
												.target
												.value,
										)
									}
									className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg"
								/>
							</div>
						</div>

						<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
							<Button
								type="button"
								variant="ghost"
								onClick={() =>
									setIsProvisionOpen(
										false,
									)
								}
								className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
								disabled={
									isProvisioning
								}
							>
								Cancel
							</Button>
							<Button
								onClick={createDb}
								disabled={
									isProvisioning
								}
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg hover:shadow-primary/20 transition-all"
							>
								{isProvisioning
									? "Provisioning..."
									: "Provision Database"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Database Confirmation Dialog */}
			<Dialog
				open={deletingDbId !== null}
				onOpenChange={(open) =>
					!open && setDeletingDbId(null)
				}
			>
				<DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Delete Database
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground mt-2">
							Are you sure you want
							to delete database{" "}
							<span className="font-semibold text-foreground font-mono">
								{
									selectedDbToDelete?.databaseName
								}
							</span>
							? This action cannot
							be undone and will
							permanently destroy
							all data tables and
							tablespace.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/40">
						<Button
							variant="ghost"
							onClick={() =>
								setDeletingDbId(
									null,
								)
							}
							className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
						>
							Cancel
						</Button>
						<Button
							onClick={
								handleDeleteDb
							}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs h-9 px-4 rounded-lg transition-all"
						>
							Destroy Database
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
