import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import * as api from "../api/client";
import type { DiagRun } from "../types";

const causeLabel = (cause: DiagRun["cause"]): string =>
	cause === "user-source" ? "your code" : cause === "dequel-source" ? "Dequel" : "inconclusive";

const runLabel = (run: { projectName: string | null; deploymentId: string }): string =>
	`${run.projectName ?? "deployment"} ${run.deploymentId.slice(0, 8)}`;

const notifyDone = (run: DiagRun & { projectName: string | null }) => {
	window.dispatchEvent(
		new CustomEvent("opencode:notification", {
			detail: {
				type: "success",
				message: `Diagnosis complete for ${runLabel(run)}: ${causeLabel(run.report?.cause ?? run.cause)}`,
			},
		}),
	);
};

const notifyError = (run: DiagRun & { projectName: string | null }) => {
	const reason = (run.error ?? "unknown error").replace(/\s+/g, " ").slice(0, 140);
	window.dispatchEvent(
		new CustomEvent("opencode:notification", {
			detail: { type: "error", message: `Diagnosis failed for ${runLabel(run)}: ${reason}` },
		}),
	);
};

export function DiagNotifier({ enabled }: { enabled: boolean }) {
	const seen = useRef(new Map<string, string | null>());
	const { data } = useQuery({
		queryKey: ["diagnoses", "active"],
		queryFn: () => api.getActiveDiagnoses(),
		refetchInterval: 10000,
		enabled,
		retry: false,
	});

	useEffect(() => {
		if (!data) return;
		const active = new Map(data.map((run) => [run.id, run.projectName]));
		for (const run of data) {
			if (!seen.current.has(run.id)) seen.current.set(run.id, run.projectName);
		}
		for (const [id, projectName] of [...seen.current]) {
			if (active.has(id)) continue;
			seen.current.delete(id);
			void api
				.getDiagnosis(id)
				.then((full) => {
					const run = { ...full.run, projectName };
					if (run.status === "done") notifyDone(run);
					else if (run.status === "error") notifyError(run);
				})
				.catch(() => {});
		}
	}, [data]);

	return null;
}
