import { Elysia } from "elysia";
import { getProjectById } from "../../db/repo";
import { getProjectStatus } from "../../monitoring/project-status";
import { fail, ok } from "../response";

const DEFAULT_WINDOW_SECONDS = 3600;
const MIN_WINDOW_SECONDS = 60;
const MAX_WINDOW_SECONDS = 604800;

const clampWindow = (raw: unknown): number => {
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) return DEFAULT_WINDOW_SECONDS;
	return Math.min(MAX_WINDOW_SECONDS, Math.max(MIN_WINDOW_SECONDS, Math.floor(value)));
};

export const projectStatusRoutes = new Elysia().get("/projects/:id/status", async ({ params: { id }, query, set }) => {
	const project = await getProjectById(id);
	if (!project) {
		set.status = 404;
		return fail("Project not found");
	}
	try {
		return ok(await getProjectStatus(id, clampWindow((query as any)?.window)));
	} catch (err) {
		console.error(`[Status] Failed to build status for project ${id}:`, err);
		set.status = 500;
		return fail("Failed to build project status");
	}
});
