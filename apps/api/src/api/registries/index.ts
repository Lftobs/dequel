import { Elysia } from "elysia";
import { createRegistry, deleteRegistry, getRegistryById, listRegistries, updateRegistry } from "../../db/repo";
import { created, fail, ok } from "../response";

export const registriesRoutes = new Elysia()
	.get("/registries", async () => ok(await listRegistries()))
	.post("/registries", async ({ body, set }: any) => {
		if (!body?.name || !body?.url || !body?.username || !body?.password) {
			set.status = 400;
			return fail("name, url, username, and password are required");
		}
		return created(
			await createRegistry({
				name: body.name,
				serverId: body.serverId || null,
				url: String(body.url)
					.replace(/^https?:\/\//, "")
					.replace(/\/$/, ""),
				username: body.username,
				password: body.password,
			}),
		);
	})
	.patch("/registries/:id", async ({ params: { id }, body, set }: any) => {
		const registry = await updateRegistry(id, body ?? {});
		if (!registry) {
			set.status = 404;
			return fail("Registry not found");
		}
		return ok(registry);
	})
	.delete("/registries/:id", async ({ params: { id }, set }) => {
		if (!(await getRegistryById(id))) {
			set.status = 404;
			return fail("Registry not found");
		}
		await deleteRegistry(id);
		return ok(null, "Registry deleted");
	});
