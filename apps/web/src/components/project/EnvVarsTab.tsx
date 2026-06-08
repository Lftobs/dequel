import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
} from "../ui/sheet";
import * as api from "../../api/client";
import {
	useDeployments,
	useRedeployDeployment,
} from "../../hooks/useDeployments";
import { Card, CardContent } from "../ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
	Upload,
	Check,
	Pencil,
	Trash2,
	KeyRound,
	Eye,
	EyeOff,
	Copy,
	Plus,
	Lock,
	RefreshCw,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "../ui/dialog";

interface EnvVarsTabProps {
	projectId: string;
}

export function EnvVarsTab({
	projectId,
}: EnvVarsTabProps) {
	const { data: envVars = [], refetch } =
		useQuery({
			queryKey: ["env-vars", projectId],
			queryFn: () =>
				api.listEnvVars(projectId),
		});

	const { data: deploymentsData } =
		useDeployments(projectId, 0, 5);
	const redeploy = useRedeployDeployment();
	const navigate = useNavigate();
	const runningDeployment =
		deploymentsData?.items?.find((d) => d.status === "running");

	const [isAddOpen, setIsAddOpen] =
		useState(false);
	const [isImportOpen, setIsImportOpen] =
		useState(false);

	const [
		showRedeployPrompt,
		setShowRedeployPrompt,
	] = useState(false);

	const [newVars, setNewVars] = useState<{ key: string; value: string; env: string }[]>([
		{ key: "", value: "", env: "" },
	]);

	const addRow = () => {
		setNewVars((prev) => [...prev, { key: "", value: "", env: "" }]);
	};

	const removeRow = (index: number) => {
		setNewVars((prev) => prev.filter((_, i) => i !== index));
	};

	const updateRow = (index: number, field: "key" | "value" | "env", val: string) => {
		setNewVars((prev) =>
			prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
		);
	};
	const [fileError, setFileError] =
		useState("");
	const [parsedFileVars, setParsedFileVars] =
		useState<
			| { key: string; value: string }[]
			| null
		>(null);
	const [importStatus, setImportStatus] =
		useState<"idle" | "importing" | "done">(
			"idle",
		);
	const [fileInputKey, setFileInputKey] =
		useState(0);
	const [editingId, setEditingId] = useState<
		string | null
	>(null);
	const [editingValue, setEditingValue] =
		useState("");
	const [savingEdit, setSavingEdit] = useState<
		Record<string, boolean>
	>({});
	const [revealValues, setRevealValues] =
		useState<Record<string, string>>({});
	const [revealing, setRevealing] = useState<
		Record<string, boolean>
	>({});
	const [copiedId, setCopiedId] = useState<
		string | null
	>(null);

	const parseEnvLines = (text: string) => {
		const lines = text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(
				(line) =>
					line && !line.startsWith("#"),
			);
		return lines
			.map((line) => {
				const idx = line.indexOf("=");
				if (idx <= 0) return null;
				const k = line
					.slice(0, idx)
					.trim();
				let v = line
					.slice(idx + 1)
					.trim();
				if (
					(v.startsWith('"') &&
						v.endsWith('"')) ||
					(v.startsWith("'") &&
						v.endsWith("'"))
				) {
					v = v.slice(1, -1);
				}
				if (!k) return null;
				return { key: k, value: v };
			})
			.filter(Boolean) as {
			key: string;
			value: string;
		}[];
	};

	const handleFileSelect = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		setFileError("");
		setImportStatus("idle");
		const file = e.target.files?.[0];
		if (!file) {
			setParsedFileVars(null);
			return;
		}
		const text = await file.text();
		const vars = parseEnvLines(text);
		if (!vars.length) {
			setFileError(
				"No valid KEY=VALUE pairs found in file.",
			);
			setParsedFileVars(null);
			setFileInputKey((k) => k + 1);
			e.target.value = "";
			return;
		}
		setParsedFileVars(vars);
	};

	const handleImport = async () => {
		if (!parsedFileVars?.length) return;
		setImportStatus("importing");
		setFileError("");
		try {
			await Promise.all(
				parsedFileVars.map((entry) =>
					api.createEnvVar(
						projectId,
						entry,
					),
				),
			);
			await refetch();
			setImportStatus("done");
			setParsedFileVars(null);
			setFileInputKey((k) => k + 1);
			setShowRedeployPrompt(true);
			setTimeout(() => {
				setImportStatus("idle");
				setIsImportOpen(false);
			}, 1500);
		} catch {
			setFileError(
				"Import failed. Try again.",
			);
			setImportStatus("idle");
		}
	};

	const startEdit = async (id: string) => {
		setEditingId(id);
		setEditingValue("");
		setSavingEdit((prev) => ({
			...prev,
			[id]: true,
		}));
		try {
			const data =
				await api.revealEnvVar(id);
			setEditingValue(data.value);
			setRevealValues((prev) => ({
				...prev,
				[id]: data.value,
			}));
		} finally {
			setSavingEdit((prev) => ({
				...prev,
				[id]: false,
			}));
		}
	};

	const saveEdit = async (id: string) => {
		setSavingEdit((prev) => ({
			...prev,
			[id]: true,
		}));
		try {
			await api.updateEnvVar(
				id,
				editingValue,
			);
			setEditingId(null);
			setEditingValue("");
			setRevealValues((prev) => ({
				...prev,
				[id]: editingValue,
			}));
			setShowRedeployPrompt(true);
			await refetch();
		} finally {
			setSavingEdit((prev) => ({
				...prev,
				[id]: false,
			}));
		}
	};

	const copyToClipboard = async (
		id: string,
	) => {
		try {
			let targetValue = revealValues[id];
			if (!targetValue) {
				setRevealing((prev) => ({
					...prev,
					[id]: true,
				}));
				const data =
					await api.revealEnvVar(id);
				targetValue = data.value;
				setRevealing((prev) => ({
					...prev,
					[id]: false,
				}));
			}
			await navigator.clipboard.writeText(
				targetValue,
			);
			setCopiedId(id);
			setTimeout(
				() => setCopiedId(null),
				1500,
			);
		} catch (err) {
			console.error("Failed to copy", err);
		}
	};

	const toggleReveal = async (id: string) => {
		if (revealValues[id]) {
			setRevealValues((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});
			return;
		}

		setRevealing((prev) => ({
			...prev,
			[id]: true,
		}));
		try {
			const data =
				await api.revealEnvVar(id);
			setRevealValues((prev) => ({
				...prev,
				[id]: data.value,
			}));
		} finally {
			setRevealing((prev) => ({
				...prev,
				[id]: false,
			}));
		}
	};

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		const validVars = newVars.filter((v) => v.key.trim() && v.value.trim());
		if (validVars.length === 0) return;

		try {
			await Promise.all(
				validVars.map((v) =>
					api.createEnvVar(projectId, {
						key: v.key.trim(),
						value: v.value.trim(),
						environment: v.env.trim() || undefined,
					})
				)
			);
			setNewVars([{ key: "", value: "", env: "" }]);
			setIsAddOpen(false);
			setShowRedeployPrompt(true);
			refetch();
		} catch (err) {
			console.error("Failed to add variables", err);
		}
	};

	return (
		<div className="space-y-6">
			{/* Redeployment Warning Banner */}
			{showRedeployPrompt &&
				runningDeployment && (
					<div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 gap-3 animate-in fade-in-0 duration-200">
						<div className="flex items-start gap-3">
							<div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/15">
								<RefreshCw
									className={`h-4 w-4 ${redeploy.isPending ? "animate-spin" : ""}`}
								/>
							</div>
							<div>
								<h4 className="text-sm font-semibold text-foreground">
									Redeployment
									Required
								</h4>
								<p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
									You have added
									or updated
									environment
									variables.
									Redeploy the
									active
									configuration
									to apply the
									new settings.
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									setShowRedeployPrompt(
										false,
									)
								}
								className="text-xs h-8 px-3 rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
								disabled={
									redeploy.isPending
								}
							>
								Dismiss
							</Button>
							<Button
								size="sm"
								onClick={async () => {
									try {
										await redeploy.mutateAsync(
											runningDeployment.id,
										);
										setShowRedeployPrompt(
											false,
										);
										navigate({ search: { tab: "deployments" } as any });
									} catch (err) {
										console.error(
											"Failed to redeploy",
											err,
										);
									}
								}}
								disabled={
									redeploy.isPending
								}
								className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-xs h-8 px-4 rounded-lg shadow-md hover:shadow-primary/10 transition-all flex items-center gap-1.5"
							>
								{redeploy.isPending ? (
									<>
										<RefreshCw className="h-3.5 w-3.5 animate-spin" />
										Redeploying...
									</>
								) : (
									<>
										<RefreshCw className="h-3.5 w-3.5" />
										Redeploy
										Now
									</>
								)}
							</Button>
						</div>
					</div>
				)}

			{envVars.length === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-12 text-center bg-card/20 backdrop-blur-sm relative overflow-hidden group min-h-[350px]">
					<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
					<div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1a1a1f] to-[#121215] border border-border flex items-center justify-center mb-6 shadow-xl group-hover:border-primary/30 transition-colors duration-300">
						<div className="absolute inset-0 bg-primary/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
						<KeyRound className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
					</div>
					<h3 className="text-lg font-semibold text-foreground mb-2">
						No Environment Variables
					</h3>
					<p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
						Store encrypted
						configuration secrets, API
						credentials, and database
						URIs injected dynamically
						into your container at
						runtime.
					</p>
					<div className="flex items-center gap-3">
						<Button
							onClick={() =>
								setIsAddOpen(true)
							}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-5 h-10 rounded-xl transition-all shadow-lg hover:shadow-primary/20"
						>
							<Plus className="h-4 w-4" />{" "}
							Add Variable
						</Button>
						<Button
							variant="outline"
							onClick={() =>
								setIsImportOpen(
									true,
								)
							}
							className="border-border hover:bg-secondary/50 font-semibold flex items-center gap-1.5 px-5 h-10 rounded-xl transition-all"
						>
							<Upload className="h-4 w-4" />{" "}
							Import .env File
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold text-foreground">
								Environment
								Variables
							</h2>
							<p className="text-sm text-muted-foreground">
								Secure, encrypted
								settings injected
								into deployments.
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								onClick={() =>
									setIsImportOpen(
										true,
									)
								}
								className="border-border hover:bg-secondary/50 text-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs"
							>
								<Upload className="h-4 w-4" />{" "}
								Import
							</Button>
							<Button
								onClick={() =>
									setIsAddOpen(
										true,
									)
								}
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 px-4 h-9 rounded-xl transition-all text-xs shadow-md"
							>
								<Plus className="h-4.5 w-4.5" />{" "}
								Add Variable
							</Button>
						</div>
					</div>

					<div className="rounded-xl border border-border bg-card/35 backdrop-blur-sm overflow-hidden">
						<Table>
							<TableHeader className="bg-[#0b0b0f]/50">
								<TableRow className="border-border hover:bg-transparent">
									<TableHead className="text-xs font-semibold py-3">
										Key
									</TableHead>
									<TableHead className="text-xs font-semibold py-3">
										Value
									</TableHead>
									<TableHead className="text-xs font-semibold py-3">
										Environment
									</TableHead>
									<TableHead className="w-32 text-right pr-6"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{envVars.map(
									(ev) => (
										<TableRow
											key={
												ev.id
											}
											className="border-border hover:bg-[#121217]/30 group transition-all"
										>
											<TableCell className="font-mono text-sm py-3.5 font-semibold text-foreground flex items-center gap-2">
												<Lock className="h-3.5 w-3.5 text-primary opacity-60 shrink-0" />
												{
													ev.key
												}
											</TableCell>
											<TableCell className="font-mono text-xs py-3.5 text-muted-foreground">
												{editingId ===
												ev.id ? (
													<Input
														value={
															editingValue
														}
														onChange={(
															e,
														) =>
															setEditingValue(
																e
																	.target
																	.value,
															)
														}
														className="h-8 bg-[#09090c] border-input text-xs font-mono"
													/>
												) : (
													<span
														className={
															revealValues[
																ev
																	.id
															]
																? "text-foreground font-semibold"
																: "opacity-45"
														}
													>
														{revealValues[
															ev
																.id
														] ??
															"••••••••"}
													</span>
												)}
											</TableCell>
											<TableCell className="py-3.5">
												{ev.environment ? (
													<Badge
														variant="outline"
														className="text-[10px] uppercase border-primary/20 text-primary bg-primary/5 px-2 py-0.5"
													>
														{
															ev.environment
														}
													</Badge>
												) : (
													<span className="text-muted-foreground/60 text-xs">
														all
														(default)
													</span>
												)}
											</TableCell>
											<TableCell className="py-3.5 pr-6 text-right">
												<div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
													{editingId ===
													ev.id ? (
														<>
															<Button
																size="sm"
																onClick={() =>
																	saveEdit(
																		ev.id,
																	)
																}
																disabled={
																	savingEdit[
																		ev
																			.id
																	]
																}
																className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-[10px] px-3 font-semibold rounded-md"
															>
																Save
															</Button>
															<Button
																size="sm"
																variant="ghost"
																onClick={() =>
																	setEditingId(
																		null,
																	)
																}
																className="h-7 text-[10px] px-2 rounded-md"
															>
																Cancel
															</Button>
														</>
													) : (
														<>
															<Button
																variant="ghost"
																size="icon"
																className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded-md transition-all"
																onClick={() =>
																	startEdit(
																		ev.id,
																	)
																}
																title="Edit value"
																disabled={
																	!!savingEdit[
																		ev
																			.id
																	]
																}
															>
																<Pencil className="h-3.5 w-3.5" />
															</Button>
															<Button
																variant="ghost"
																size="icon"
																className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded-md transition-all"
																onClick={() =>
																	toggleReveal(
																		ev.id,
																	)
																}
																title={
																	revealValues[
																		ev
																			.id
																	]
																		? "Hide value"
																		: "Reveal value"
																}
																disabled={
																	!!revealing[
																		ev
																			.id
																	]
																}
															>
																{revealValues[
																	ev
																		.id
																] ? (
																	<EyeOff className="h-3.5 w-3.5" />
																) : (
																	<Eye className="h-3.5 w-3.5" />
																)}
															</Button>
															<Button
																variant="ghost"
																size="icon"
																className={`h-7 w-7 rounded-md transition-all ${
																	copiedId ===
																	ev.id
																		? "text-emerald-400 bg-emerald-500/10"
																		: "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
																}`}
																onClick={() =>
																	copyToClipboard(
																		ev.id,
																	)
																}
																title="Copy value"
																disabled={
																	!!revealing[
																		ev
																			.id
																	]
																}
															>
																{copiedId ===
																ev.id ? (
																	<Check className="h-3.5 w-3.5" />
																) : (
																	<Copy className="h-3.5 w-3.5" />
																)}
															</Button>
														</>
													)}
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
														onClick={() =>
															api
																.deleteEnvVar(
																	ev.id,
																)
																.then(
																	() => {
																		setShowRedeployPrompt(
																			true,
																		);
																		refetch();
																	},
																)
														}
													>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									),
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			)}

			{/* Add Variable Sheet */}
			<Sheet
				open={isAddOpen}
				onOpenChange={setIsAddOpen}
			>
				<SheetContent className="sm:max-w-[460px] bg-card border-border text-foreground shadow-2xl flex flex-col h-full">
					<SheetHeader>
						<SheetTitle>
							Add Environment Variables
						</SheetTitle>
						<SheetDescription>
							Store configuration keys that will be injected into your service deployments. You can add multiple variables at once.
						</SheetDescription>
					</SheetHeader>

					<form
						onSubmit={add}
						className="flex flex-col flex-1 min-h-0"
					>
						<div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">
							{newVars.map((v, index) => (
								<div
									key={index}
									className="p-4 rounded-xl bg-[#0a0a0d] border border-border/60 relative space-y-3 group"
								>
									{newVars.length > 1 && (
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => removeRow(index)}
											className="absolute top-3 right-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 rounded-lg transition-colors"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									)}
									<div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
										Variable #{index + 1}
									</div>
									<div className="space-y-1">
										<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
											Variable Key
										</label>
										<Input
											placeholder="e.g. DATABASE_URL"
											value={v.key}
											onChange={(e) =>
												updateRow(index, "key", e.target.value)
											}
											className="h-9 bg-[#0d0d11] border-input focus:ring-1 focus:ring-primary text-xs font-semibold rounded-lg font-mono"
											required
										/>
									</div>

									<div className="space-y-1">
										<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
											Variable Value
										</label>
										<Input
											placeholder="e.g. postgresql://user:pass@host:5432/db"
											value={v.value}
											onChange={(e) =>
												updateRow(index, "value", e.target.value)
											}
											className="h-9 bg-[#0d0d11] border-input focus:ring-1 focus:ring-primary text-xs font-semibold rounded-lg"
											required
										/>
									</div>

									<div className="space-y-1">
										<label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
											Environment Scope (Optional)
										</label>
										<select
											value={v.env}
											onChange={(e) =>
												updateRow(index, "env", e.target.value)
											}
											className="flex h-9 w-full rounded-lg border border-input bg-[#0d0d11] px-3 py-1.5 text-xs shadow-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
										>
											<option value="">All Environments</option>
											<option value="production">Production</option>
											<option value="preview">Preview</option>
											<option value="development">Development</option>
										</select>
									</div>
								</div>
							))}

							<Button
								type="button"
								variant="outline"
								onClick={addRow}
								className="w-full border-dashed border-border hover:border-primary/40 hover:bg-secondary/20 text-xs font-semibold h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all"
							>
								<Plus className="h-3.5 w-3.5" /> Add Variable Row
							</Button>
						</div>

						<SheetFooter>
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									setIsAddOpen(false);
									setNewVars([{ key: "", value: "", env: "" }]);
								}}
								className="h-9 text-xs px-4 rounded-lg hover:bg-[#1a1a21]"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 text-xs px-5 rounded-lg shadow-lg hover:shadow-primary/20 transition-all"
							>
								Add Variables
							</Button>
						</SheetFooter>
					</form>
				</SheetContent>
			</Sheet>

			{/* Import .env File Dialog */}
			<Dialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
			>
				<DialogContent className="sm:max-w-[450px] bg-card border-border text-foreground rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-foreground">
							Import .env File
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Upload a local
							configuration file to
							quickly populate keys.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 pt-2">
						{/* Dashed drop zone */}
						<div className="relative border-2 border-dashed border-border rounded-xl p-6 hover:border-primary/40 transition-colors bg-[#0d0d11]/40 flex flex-col items-center justify-center text-center group">
							<Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors mb-3" />
							<p className="text-xs font-semibold text-foreground mb-1">
								Select a file or
								drag here
							</p>
							<p className="text-[10px] text-muted-foreground">
								Supports .env or
								.txt key-value
								files
							</p>
							<Input
								key={fileInputKey}
								type="file"
								accept=".env,.txt"
								onChange={
									handleFileSelect
								}
								className="absolute inset-0 opacity-0 cursor-pointer"
							/>
						</div>

						{parsedFileVars &&
							importStatus !==
								"done" && (
								<div className="space-y-3">
									<div className="flex items-center justify-between text-xs">
										<span className="text-muted-foreground">
											Parsed
											variables:
										</span>
										<span className="font-semibold text-primary">
											{
												parsedFileVars.length
											}{" "}
											found
										</span>
									</div>
									{/* Mini Scrollable Preview list */}
									<div className="max-h-[140px] overflow-y-auto border border-border rounded-lg bg-[#070709] divide-y divide-border/40 font-mono text-[10px]">
										{parsedFileVars
											.slice(
												0,
												10,
											)
											.map(
												(
													v,
													idx,
												) => (
													<div
														key={
															idx
														}
														className="flex items-center justify-between p-2"
													>
														<span className="text-foreground font-semibold truncate max-w-[150px]">
															{
																v.key
															}
														</span>
														<span className="text-muted-foreground truncate max-w-[200px]">
															{
																v.value
															}
														</span>
													</div>
												),
											)}
										{parsedFileVars.length >
											10 && (
											<div className="p-2 text-center text-muted-foreground/60 italic border-t border-border/40">
												+{" "}
												{parsedFileVars.length -
													10}{" "}
												more
												variables
											</div>
										)}
									</div>
								</div>
							)}

						{fileError && (
							<div className="text-xs text-destructive flex items-center gap-1.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 font-semibold">
								{fileError}
							</div>
						)}

						{importStatus ===
							"done" && (
							<div className="text-xs text-emerald-400 flex items-center justify-center gap-1.5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-semibold">
								<Check className="h-4 w-4" />{" "}
								Successfully
								Imported
								Variables!
							</div>
						)}

						<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									setIsImportOpen(
										false,
									);
									setParsedFileVars(
										null,
									);
									setFileError(
										"",
									);
								}}
								className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
								disabled={
									importStatus ===
									"importing"
								}
							>
								Cancel
							</Button>
							{parsedFileVars &&
								importStatus !==
									"done" && (
									<Button
										onClick={
											handleImport
										}
										disabled={
											importStatus ===
											"importing"
										}
										className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg hover:shadow-primary/20 transition-all"
									>
										{importStatus ===
										"importing"
											? "Importing..."
											: `Import ${parsedFileVars.length} Variables`}
									</Button>
								)}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
