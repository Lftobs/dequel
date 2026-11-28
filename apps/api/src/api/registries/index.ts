import { Elysia } from "elysia";
import { createRegistry, deleteRegistry, getRegistryById, listRegistries, updateRegistry } from "../../db/repo";
import { auditRequest } from "../audit";
import { created, fail, ok } from "../response";

export const registriesRoutes = new Elysia()
	.get("/registries", async () => ok(await listRegistries()))
	.post("/registries", async ({ body, request, set }: any) => {
		if (!body?.name || !body?.url || !body?.username || !body?.password) {
			set.status = 400;
			return fail("name, url, username, and password are required");
		}
		const registry = await createRegistry({
			name: body.name,
			serverId: body.serverId || null,
			url: String(body.url)
				.replace(/^https?:\/\//, "")
				.replace(/\/$/, ""),
			username: body.username,
			password: body.password,
		});
		await auditRequest(request, {
			action: "registry.created",
			resourceType: "registry",
			resourceId: registry.id,
			details: { name: registry.name, url: registry.url, username: registry.username },
		});
		return created(registry);
	})
	.patch("/registries/:id", async ({ params: { id }, body, request, set }: any) => {
		const registry = await updateRegistry(id, body ?? {});
		if (!registry) {
			set.status = 404;
			return fail("Registry not found");
		}
		await auditRequest(request, {
			action: "registry.updated",
			resourceType: "registry",
			resourceId: id,
			details: { fields: Object.keys(body ?? {}) },
		});
		return ok(registry);
	})
	.delete("/registries/:id", async ({ params: { id }, request, set }) => {
		if (!(await getRegistryById(id))) {
			set.status = 404;
			return fail("Registry not found");
		}
		await deleteRegistry(id);
		await auditRequest(request, {
			action: "registry.deleted",
			resourceType: "registry",
			resourceId: id,
		});
		return ok(null, "Registry deleted");
	});
