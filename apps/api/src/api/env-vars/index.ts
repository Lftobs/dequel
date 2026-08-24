import { Elysia } from "elysia";
import {
	createEnvironmentVariable,
	deleteEnvironmentVariable,
	getEnvironmentVariablePlaintext,
	listEnvironmentVariables,
	updateEnvironmentVariable,
} from "../../db/repo";
import { ok, created, fail } from "../response";

const handleError = (e: unknown, set: any) => {
	console.error("Env var error:", e);
	set.status = 500;
	return fail("Internal server error");
};

export const envVarsRoutes = new Elysia()
	.get(
		"/projects/:id/env-vars",
		async ({ params: { id }, query }: any) =>
			ok(await listEnvironmentVariables(id, query.environment)),
	)
	.post(
		"/projects/:id/env-vars",
		async ({ params: { id }, body, set }: any) => {
			try {
				if (!body?.key || body.value === undefined) {
					set.status = 400;
					return fail("key and value are required");
				}
				return created(await createEnvironmentVariable({
					projectId: id,
					key: body.key,
					value: body.value,
					environment: body.environment,
				}));
			} catch (e) {
				return handleError(e, set);
			}
		},
	)
	.patch(
		"/env-vars/:id",
		async ({ params: { id }, body, set }: any) => {
			try {
				if (body.value === undefined) {
					set.status = 400;
					return fail("value is required");
				}
				const ev = await updateEnvironmentVariable(id, body.value);
				if (!ev) {
					set.status = 404;
					return fail("Environment variable not found");
				}
				return ok(ev);
			} catch (e) {
				return handleError(e, set);
			}
		},
	)
	.get(
		"/env-vars/:id/reveal",
		async ({ params: { id }, set }) => {
			try {
				const value =
					await getEnvironmentVariablePlaintext(id);
				if (value === null) {
					set.status = 404;
					return fail("Environment variable not found");
				}
				return ok({ value });
			} catch (e) {
				return handleError(e, set);
			}
		},
	)
	.delete(
		"/env-vars/:id",
		async ({ params: { id }, set }) => {
			try {
				const deleted = await deleteEnvironmentVariable(id);
				if (!deleted) {
					set.status = 404;
					return fail("Environment variable not found");
				}
				return ok(null, "Environment variable deleted");
			} catch (e) {
				return handleError(e, set);
			}
		},
	);
