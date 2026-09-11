import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, deleteProject, listProjects, updateProject } from "../api/client";

export function useProjects(options?: { enabled?: boolean }) {
	return useQuery({ queryKey: ["projects"], queryFn: listProjects, refetchInterval: 10_000, ...options });
}

export function useProject(id: string) {
	return useQuery({
		queryKey: ["project", id],
		queryFn: () => import("../api/client").then((m) => m.getProject(id)),
		enabled: !!id,
	});
}

export function useCreateProject() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: Parameters<typeof createProject>[0]) => createProject(data),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
	});
}

export function useUpdateProject() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...data }: Parameters<typeof updateProject>[1] & { id: string }) => updateProject(id, data),
		onSuccess: (_, variables) => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			qc.invalidateQueries({ queryKey: ["project", variables.id] });
		},
	});
}

export function useDeleteProject() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteProject(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			qc.invalidateQueries({ queryKey: ["all-deployments"] });
		},
	});
}
