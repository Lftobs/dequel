import { Elysia } from "elysia";
import {
	createEnvironmentVariable,
	deleteEnvironmentVariable,
	getEnvironmentVariablePlaintext,
	listEnvironmentVariables,
	updateEnvironmentVariable,
} from "../../db/repo";

const handleError = (e: unknown, set: any) => {
	console.error("Env var error:", e);
	set.status = 500;
	return { error: "Internal server error" };
};

export const envVarsRoutes = new Elysia()
	.get(
		"/projects/:id/env-vars",
		async ({ params: { id }, query }: any) =>
			listEnvironmentVariables(id, query.environment),
	)
	.post(
		"/projects/:id/env-vars",
		async ({ params: { id }, body, set }: any) => {
			try {
				if (!body?.key || body.value === undefined) {
					set.status = 400;
					return { error: "key and value are required" };
				}
				return await createEnvironmentVariable({
					projectId: id,
					key: body.key,
					value: body.value,
					environment: body.environment,
				});
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
					return { error: "value is required" };
				}
				const ev = await updateEnvironmentVariable(id, body.value);
				if (!ev) {
					set.status = 404;
					return { error: "Environment variable not found" };
				}
				return ev;
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
					return {
						error: "Environment variable not found",
					};
				}
				return { value };
			} catch (e) {
				return handleError(e, set);
			}
		},
	)
	.delete(
		"/env-vars/:id",
		async ({ params: { id }, set }) => {
			try {
				const ok = await deleteEnvironmentVariable(id);
				if (!ok) {
					set.status = 404;
					return { error: "Environment variable not found" };
				}
				return { ok: true };
			} catch (e) {
				return handleError(e, set);
			}
		},
	);
