import { Elysia } from "elysia";
import {
	createApiKey,
	deleteApiKey,
	listApiKeys,
} from "../../db/repo";

export const apiKeysRoutes = new Elysia()
	.get("/api-keys", async () => listApiKeys())
	.post(
		"/api-keys",
		async ({ body, set }: any) => {
			if (!body?.name) {
				set.status = 400;
				return { error: "name is required" };
			}
			const { key, rawKey } = await createApiKey({
				name: body.name,
				permissions: body.permissions,
			});
			return { ...key, rawKey };
		},
	)
	.delete(
		"/api-keys/:id",
		async ({ params: { id }, set }) => {
			const ok = await deleteApiKey(id);
			if (!ok) {
				set.status = 404;
				return { error: "API key not found" };
			}
			return { ok: true };
		},
	);
