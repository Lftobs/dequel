import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import * as api from "../../../api/client";
import {
	useDeployments,
	useRedeployDeployment,
} from "../../../hooks/useDeployments";
import { RedeployBanner } from "./RedeployBanner";
import { EmptyEnvState } from "./EmptyEnvState";
import { EnvVarTable } from "./EnvVarTable";
import { AddEnvVarSheet } from "./AddEnvVarSheet";
import { ImportEnvFileDialog } from "./ImportEnvFileDialog";
import { DeleteEnvVarDialog } from "./DeleteEnvVarDialog";

interface EnvVarsTabProps {
	projectId: string;
}

export function EnvVarsTab({ projectId }: EnvVarsTabProps) {
	const { data: envVars = [], refetch } = useQuery({
		queryKey: ["env-vars", projectId],
		queryFn: () => api.listEnvVars(projectId),
	});

	const { data: deploymentsData } = useDeployments(projectId, 0, 5);
	const redeploy = useRedeployDeployment();
	const navigate = useNavigate();
	const runningDeployment =
		deploymentsData?.items?.find((d) => d.status === "running");

	const [isAddOpen, setIsAddOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [showRedeployPrompt, setShowRedeployPrompt] = useState(false);
	const [deletingEvId, setDeletingEvId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingValue, setEditingValue] = useState("");
	const [savingEdit, setSavingEdit] = useState<Record<string, boolean>>({});
	const [revealValues, setRevealValues] = useState<Record<string, string>>({});
	const [revealing, setRevealing] = useState<Record<string, boolean>>({});
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const handleDeleteEnvVar = async () => {
		if (!deletingEvId) return;
		await api.deleteEnvVar(deletingEvId);
		setDeletingEvId(null);
		setShowRedeployPrompt(true);
		refetch();
	};

	const startEdit = async (id: string) => {
		setEditingId(id);
		setEditingValue("");
		setSavingEdit((prev) => ({ ...prev, [id]: true }));
		try {
			const data = await api.revealEnvVar(id);
			setEditingValue(data.value);
			setRevealValues((prev) => ({ ...prev, [id]: data.value }));
		} finally {
			setSavingEdit((prev) => ({ ...prev, [id]: false }));
		}
	};

	const saveEdit = async (id: string) => {
		setSavingEdit((prev) => ({ ...prev, [id]: true }));
		try {
			await api.updateEnvVar(id, editingValue);
			setEditingId(null);
			setEditingValue("");
			setRevealValues((prev) => ({ ...prev, [id]: editingValue }));
			setShowRedeployPrompt(true);
			await refetch();
		} finally {
			setSavingEdit((prev) => ({ ...prev, [id]: false }));
		}
	};

	const copyToClipboard = async (id: string) => {
		try {
			let targetValue = revealValues[id];
			if (!targetValue) {
				setRevealing((prev) => ({ ...prev, [id]: true }));
				const data = await api.revealEnvVar(id);
				targetValue = data.value;
				setRevealing((prev) => ({ ...prev, [id]: false }));
			}
			await navigator.clipboard.writeText(targetValue);
			setCopiedId(id);
			setTimeout(() => setCopiedId(null), 1500);
		} catch (err) {
			console.error("Failed to copy", err);
		}
	};

	const handleReveal = async (id: string) => {
		setRevealing((prev) => ({ ...prev, [id]: true }));
		try {
			const data = await api.revealEnvVar(id);
			setRevealValues((prev) => ({ ...prev, [id]: data.value }));
		} finally {
			setRevealing((prev) => ({ ...prev, [id]: false }));
		}
	};

	const handleHide = (id: string) => {
		setRevealValues((prev) => {
			const next = { ...prev };
			delete next[id];
			return next;
		});
	};

	const handleAddVars = async (
		vars: { key: string; value: string; env: string }[],
	) => {
		await Promise.all(
			vars.map((v) =>
				api.createEnvVar(projectId, {
					key: v.key.trim(),
					value: v.value.trim(),
					environment: v.env.trim() || undefined,
				}),
			),
		);
		setIsAddOpen(false);
		setShowRedeployPrompt(true);
		refetch();
	};

	const handleImportVars = async (
		vars: { key: string; value: string }[],
	) => {
		await Promise.all(
			vars.map((entry) => api.createEnvVar(projectId, entry)),
		);
		await refetch();
		setShowRedeployPrompt(true);
	};

	const handleRedeploy = async () => {
		try {
			await redeploy.mutateAsync(runningDeployment!.id);
			setShowRedeployPrompt(false);
			navigate({ search: { tab: "deployments" } as any });
		} catch (err) {
			console.error("Failed to redeploy", err);
		}
	};

	return (
		<div className="space-y-6">
			<RedeployBanner
				show={showRedeployPrompt}
				runningDeploymentId={runningDeployment?.id}
				isPending={redeploy.isPending}
				onDismiss={() => setShowRedeployPrompt(false)}
				onRedeploy={handleRedeploy}
			/>

			{envVars.length === 0 ? (
				<EmptyEnvState
					onAdd={() => setIsAddOpen(true)}
					onImport={() => setIsImportOpen(true)}
				/>
			) : (
				<EnvVarTable
					envVars={envVars}
					editingId={editingId}
					editingValue={editingValue}
					savingEdit={savingEdit}
					revealValues={revealValues}
					revealing={revealing}
					copiedId={copiedId}
					onAdd={() => setIsAddOpen(true)}
					onImport={() => setIsImportOpen(true)}
					onDelete={(id) => setDeletingEvId(id)}
					onStartEdit={startEdit}
					onCancelEdit={() => {
						setEditingId(null);
						setEditingValue("");
					}}
					onSaveEdit={saveEdit}
					onReveal={handleReveal}
					onHide={handleHide}
					onCopy={copyToClipboard}
					onEditingValueChange={setEditingValue}
				/>
			)}

			<AddEnvVarSheet
				open={isAddOpen}
				onOpenChange={setIsAddOpen}
				onSubmit={handleAddVars}
			/>

			<ImportEnvFileDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				onImport={handleImportVars}
			/>

			<DeleteEnvVarDialog
				open={deletingEvId !== null}
				onOpenChange={(open) => {
					if (!open) setDeletingEvId(null);
				}}
				onConfirm={handleDeleteEnvVar}
			/>
		</div>
	);
}
