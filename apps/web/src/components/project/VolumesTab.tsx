import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "../../api/client";
import { Card, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";

interface VolumesTabProps {
	projectId: string;
}

export function VolumesTab({ projectId }: VolumesTabProps) {
	const { data: volumes = [], refetch } =
		useQuery({
			queryKey: ["volumes", projectId],
			queryFn: () =>
				api.listVolumes(projectId),
		});
	const [mountPath, setMountPath] =
		useState("/app/data");

	const add = async (e: React.FormEvent) => {
		e.preventDefault();
		await api.createVolume(
			projectId,
			mountPath,
		);
		setMountPath("/app/data");
		refetch();
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="pt-6">
					<form
						onSubmit={add}
						className="flex gap-2"
					>
						<Input
							placeholder="Mount path"
							value={mountPath}
							onChange={(e) =>
								setMountPath(
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
							Add Volume
						</Button>
					</form>
				</CardContent>
			</Card>
			{volumes.length > 0 && (
				<div className="rounded-xl border border-border bg-card overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									Mount Path
								</TableHead>
								<TableHead>
									Volume Name
								</TableHead>
								<TableHead>
									Created
								</TableHead>
								<TableHead className="w-12"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{volumes.map((v) => (
								<TableRow
									key={v.id}
								>
									<TableCell className="font-mono text-sm">
										{
											v.mountPath
										}
									</TableCell>
									<TableCell className="font-mono text-xs text-muted-foreground">
										{v.dockerVolumeName ??
											"—"}
									</TableCell>
									<TableCell className="text-muted-foreground text-xs">
										{new Date(
											v.createdAt,
										).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-muted-foreground hover:text-destructive"
											onClick={() =>
												api
													.deleteVolume(
														v.id,
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
