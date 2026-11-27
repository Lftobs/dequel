import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import packageJson from "../../package.json";
import { loadTypeReferences } from "./openapi-declaration";

export const openApiRoutes = new Elysia().use(
	openapi({
		path: "/docs",
		specPath: "/openapi.json",
		provider: "swagger-ui",
		openapiVersion: "3.1.0",
		references: loadTypeReferences,
		documentation: {
			info: {
				title: "Dequl API",
				version: packageJson.version,
				description:
					"Dequl control-plane API. Authenticate with a session cookie or `Authorization: Bearer <api key>`. Keys carry read/write scopes and can be scoped to one project.",
			},
			servers: [{ url: "/" }],
			components: {
				securitySchemes: {
					bearerAuth: { type: "http", scheme: "bearer" },
					sessionCookie: { type: "apiKey", in: "cookie", name: "dequl_session" },
				},
			},
			security: [{ bearerAuth: [] }, { sessionCookie: [] }],
		},
	}),
);
