import { Elysia } from "elysia";
import { createApiKey, deleteApiKey, listApiKeys } from "../../db/repo";
import { created, fail, ok } from "../response";

export const apiKeysRoutes = new Elysia()
	.get("/api-keys", async () => ok(await listApiKeys()))
	.post("/api-keys", async ({ body, set }: any) => {
		if (!body?.name) {
			set.status = 400;
			return fail("name is required");
		}
		const { key, rawKey } = await createApiKey({
			name: body.name,
			permissions: body.permissions,
		});
		return created({ ...key, rawKey });
	})
	.delete("/api-keys/:id", async ({ params: { id }, set }) => {
		const deleted = await deleteApiKey(id);
		if (!deleted) {
			set.status = 404;
			return fail("API key not found");
		}
		return ok(null, "API key deleted");
	});
