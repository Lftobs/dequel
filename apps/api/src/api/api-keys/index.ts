import { Elysia } from "elysia";
import { createApiKey, deleteApiKey, listApiKeys, pauseApiKey, rollApiKey } from "../../db/repo";
import { created, fail, ok } from "../response";

export const apiKeysRoutes = new Elysia()
	.get("/api-keys", async () => ok(await listApiKeys()))
	.post("/api-keys", async ({ body, set }: any) => {
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
		return created({ ...key, rawKey });
	})
	.patch("/api-keys/:id", async ({ params: { id }, body, set }: any) => {
		if (body?.paused === undefined) {
			set.status = 400;
			return fail("paused is required");
		}
		const key = await pauseApiKey(id, Boolean(body.paused));
		if (!key) {
			set.status = 404;
			return fail("API key not found");
		}
		return ok(key);
	})
	.post("/api-keys/:id/roll", async ({ params: { id }, set }) => {
		const rolled = await rollApiKey(id);
		if (!rolled) {
			set.status = 404;
			return fail("API key not found");
		}
		return created({ ...rolled.key, rawKey: rolled.rawKey });
	})
	.delete("/api-keys/:id", async ({ params: { id }, set }) => {
		const deleted = await deleteApiKey(id);
		if (!deleted) {
			set.status = 404;
			return fail("API key not found");
		}
		return ok(null, "API key deleted");
	});
