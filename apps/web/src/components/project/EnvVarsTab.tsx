import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "../../api/client";
import { Card, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Upload, Check, Pencil, Trash2 } from "lucide-react";

interface EnvVarsTabProps {
	projectId: string;
}

export function EnvVarsTab({ projectId }: EnvVarsTabProps) {
	const { data: envVars = [], refetch } =
		useQuery({
			queryKey: ["env-vars", projectId],
			queryFn: () =>
				api.listEnvVars(projectId),
		});
	const [key, setKey] = useState("");
	const [value, setValue] = useState("");
	const [fileError, setFileError] = useState("");
	const [parsedFileVars, setParsedFileVars] = useState<
		{ key: string; value: string }[] | null
	>(null);
	const [importStatus, setImportStatus] = useState<
		"idle" | "importing" | "done"
	>("idle");
	const [fileInputKey, setFileInputKey] = useState(0);
	const [editingId, setEditingId] = useState<
		string | null
	>(null);
	const [editingValue, setEditingValue] =
		useState("");
	const [savingEdit, setSavingEdit] = useState<
		Record<string, boolean>
	>({});
	const [revealValues, setRevealValues] = useState<
		Record<string, string>
	>({});
	const [revealing, setRevealing] = useState<
		Record<string, boolean>
	>({});

	const parseEnvLines = (text: string) => {
		const lines = text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));
		return lines
			.map((line) => {
				const idx = line.indexOf("=");
				if (idx <= 0) return null;
				const k = line.slice(0, idx).trim();
				let v = line.slice(idx + 1).trim();
				if (
					(v.startsWith("\"") && v.endsWith("\"")) ||
					(v.startsWith("'") && v.endsWith("'"))
				) {
					v = v.slice(1, -1);
				}
				if (!k) return null;
				return { key: k, value: v };
			})
			.filter(Boolean) as { key: string; value: string }[];
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
					api.createEnvVar(projectId, entry),
				),
			);
			await refetch();
			setImportStatus("done");
			setParsedFileVars(null);
			setFileInputKey((k) => k + 1);
			setTimeout(() => setImportStatus("idle"), 3000);
		} catch {
			setFileError("Import failed. Try again.");
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
			const data = await api.revealEnvVar(id);
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
			await api.updateEnvVar(id, editingValue);
			setEditingId(null);
			setEditingValue("");
			setRevealValues((prev) => ({
				...prev,
				[id]: editingValue,
			}));
			await refetch();
		} finally {
			setSavingEdit((prev) => ({
				...prev,
				[id]: false,
			}));
		}
	};

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!key.trim() || !value.trim()) return;
		await api.createEnvVar(projectId, {
			key: key.trim(),
			value: value.trim(),
		});
		setKey("");
		setValue("");
		refetch();
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="pt-6">
					<div className="grid gap-3">
						<form
							onSubmit={add}
							className="flex gap-2"
						>
							<Input
								placeholder="KEY"
								value={key}
								onChange={(e) =>
									setKey(
										e.target
										.value,
									)
								}
								className="w-48 font-mono"
							/>
							<Input
								placeholder="value"
								value={value}
								onChange={(e) =>
									setValue(
										e.target
										.value,
									)
								}
								className="flex-1"
							/>
							<Button
								type="submit"
								size="sm"
							>
								Add
							</Button>
						</form>
						<div className="rounded-xl border border-dashed border-border p-4 space-y-3">
							<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
								<Upload className="h-4 w-4" />
								Import from .env file
							</div>
							<div className="flex items-center gap-2">
								<Input
									key={fileInputKey}
									type="file"
									accept=".env,.txt"
									className="file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground"
									onChange={handleFileSelect}
								/>
								{parsedFileVars && importStatus !== "done" && (
									<Button
										size="sm"
										onClick={handleImport}
										disabled={
											importStatus ===
											"importing"
										}
									>
										{importStatus === "importing"
											? "Importing..."
											: `Import ${parsedFileVars.length} vars`}
									</Button>
								)}
								{importStatus === "done" && (
									<span className="flex items-center gap-1 text-xs text-emerald-500 shrink-0">
										<Check className="h-3.5 w-3.5" />
										Imported
									</span>
								)}
							</div>
							{parsedFileVars && importStatus !== "done" && (
								<p className="text-xs text-muted-foreground">
									{parsedFileVars.length}{" "}
									variable
									{parsedFileVars.length !== 1
										? "s"
										: ""}{" "}
									found. Click Import to create
									them.
								</p>
							)}
							{fileError && (
								<div className="text-xs text-destructive">
									{fileError}
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
			{envVars.length > 0 && (
				<div className="rounded-xl border border-border bg-card overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									Key
								</TableHead>
								<TableHead>
									Value
								</TableHead>
								<TableHead>
									Environment
								</TableHead>
								<TableHead className="w-20"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{envVars.map((ev) => (
								<TableRow
									key={ev.id}
								>
									<TableCell className="font-mono text-sm">
										{ev.key}
									</TableCell>
									<TableCell className="font-mono text-xs text-muted-foreground">
										{editingId === ev.id ? (
											<Input
												value={editingValue}
												onChange={(e) =>
													setEditingValue(
														e.target.value,
													)
												}
												className="h-8 text-xs"
											/>
										) : (
											revealValues[ev.id] ?? "••••••••"
										)}
									</TableCell>
									<TableCell>
										{ev.environment ? (
											<Badge
												variant="secondary"
												className="text-xs"
											>
												{
													ev.environment
												}
											</Badge>
										) : (
											<span className="text-muted-foreground">
												—
											</span>
										)}
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-end gap-1">
											{editingId === ev.id ? (
												<>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															saveEdit(
																ev.id,
															)
														}
														disabled={
															savingEdit[
																ev.id
															]
														}
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
													>
														Cancel
													</Button>
												</>
											) : (
												<>
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-foreground"
														onClick={() => startEdit(ev.id)}
														title="Edit value"
														disabled={!!savingEdit[ev.id]}
													>
														<Pencil className="h-3.5 w-3.5" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-foreground"
														onClick={async () => {
															if (revealValues[ev.id]) {
																setRevealValues(
																	(prev) => {
																		const next = { ...prev };
																		delete next[ev.id];
																		return next;
																	},
																);
																return;
															}
															setRevealing((prev) => ({
																...prev,
																[ev.id]: true,
															}));
															try {
																const data =
																	await api.revealEnvVar(
																		ev.id,
																	);
																setRevealValues(
																	(prev) => ({
																		...prev,
																		[ev.id]:
																			data.value,
																	}),
																);
															} finally {
																setRevealing(
																	(prev) => ({
																		...prev,
																		[ev.id]:
																			false,
																	}),
																);
															}
														}}
														title={
															revealValues[ev.id]
																? "Hide value"
																: "Reveal value"
														}
														disabled={!!revealing[ev.id]}
													>
														{revealValues[ev.id]
															? "•"
															: "👁"}
													</Button>
												</>
											)}
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 text-muted-foreground hover:text-destructive"
												onClick={() =>
													api
														.deleteEnvVar(
															ev.id,
														)
														.then(
															() =>
																refetch(),
														)
												}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
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
