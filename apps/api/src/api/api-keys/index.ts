import { Elysia } from "elysia";
import { createApiKey, deleteApiKey, listApiKeys, pauseApiKey, rollApiKey } from "../../db/repo";
import { auditRequest } from "../audit";
import { created, fail, ok } from "../response";

export const apiKeysRoutes = new Elysia()
	.get("/api-keys", async () => ok(await listApiKeys()))
	.post("/api-keys", async ({ body, request, set }: any) => {
		if (!body?.name) {
			set.status = 400;
			return fail("name is required");
		}
		if (body.projectId) {
			const { getProjectById } = await import("../../db/repo");
			if (!(await getProjectById(body.projectId))) {
				set.status = 400;
				return fail("Project not found");
			}
		}
		const { key, rawKey } = await createApiKey({
			name: body.name,
			permissions: body.permissions,
			projectId: body.projectId ?? null,
		});
		await auditRequest(request, {
			action: "api_key.created",
			resourceType: "api_key",
			resourceId: key.id,
			details: { name: key.name, permissions: key.permissions, projectId: key.projectId },
		});
		return created({ ...key, rawKey });
	})
	.patch("/api-keys/:id", async ({ params: { id }, body, request, set }: any) => {
		if (body?.paused === undefined) {
			set.status = 400;
			return fail("paused is required");
		}
		const key = await pauseApiKey(id, Boolean(body.paused));
		if (!key) {
			set.status = 404;
			return fail("API key not found");
		}
		await auditRequest(request, {
			action: key.pausedAt ? "api_key.paused" : "api_key.resumed",
			resourceType: "api_key",
			resourceId: id,
			details: { name: key.name },
		});
		return ok(key);
	})
	.post("/api-keys/:id/roll", async ({ params: { id }, request, set }) => {
		const rolled = await rollApiKey(id);
		if (!rolled) {
			set.status = 404;
			return fail("API key not found");
		}
		await auditRequest(request, {
			action: "api_key.rolled",
			resourceType: "api_key",
			resourceId: id,
			details: { name: rolled.key.name },
		});
		return created({ ...rolled.key, rawKey: rolled.rawKey });
	})
	.delete("/api-keys/:id", async ({ params: { id }, request, set }) => {
		const deleted = await deleteApiKey(id);
		if (!deleted) {
			set.status = 404;
			return fail("API key not found");
		}
		await auditRequest(request, {
			action: "api_key.deleted",
			resourceType: "api_key",
			resourceId: id,
		});
		return ok(null, "API key deleted");
	});
