import { Elysia } from "elysia";

const json = { "application/json": { schema: { type: "object" } } };
const errorResponse = { description: "Error", content: json };
const okResponse = { description: "OK", content: json };

const projectSchema = {
	type: "object",
	properties: {
		id: { type: "string" },
		name: { type: "string" },
		sourceType: { type: "string", enum: ["git", "upload", "image"] },
		buildType: { type: "string", enum: ["railpack", "dockerfile", "compose"] },
		imageRef: { type: "string", nullable: true },
		healthCheck: { type: "object", nullable: true },
		tags: { type: "array", items: { type: "string" } },
	},
};

const spec = {
	openapi: "3.1.0",
	info: {
		title: "Dequel API",
		version: "0.4.0",
		description:
			"Dequel control-plane API. Authenticate with a session cookie or `Authorization: Bearer <api key>`. Keys carry read/write scopes and can be scoped to one project.",
	},
	servers: [{ url: "/api" }],
	components: {
		securitySchemes: {
			bearerAuth: { type: "http", scheme: "bearer" },
			sessionCookie: { type: "apiKey", in: "cookie", name: "dequel_session" },
		},
		schemas: { Project: projectSchema },
	},
	security: [{ bearerAuth: [] }, { sessionCookie: [] }],
	paths: {
		"/projects": {
			get: { summary: "List projects", responses: { "200": okResponse, "401": errorResponse } },
			post: {
				summary: "Create a project",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name"],
								properties: {
									name: { type: "string" },
									sourceType: { type: "string", enum: ["git", "upload", "image"] },
									buildType: { type: "string", enum: ["railpack", "dockerfile", "compose"] },
									repoUrl: { type: "string" },
									repoBranch: { type: "string" },
									imageRef: { type: "string" },
									dockerfilePath: { type: "string" },
									dockerTarget: { type: "string" },
									healthCheck: { type: "object" },
									tags: { type: "array", items: { type: "string" } },
								},
							},
						},
					},
				},
				responses: { "201": okResponse, "400": errorResponse },
			},
		},
		"/projects/{id}": {
			parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
			get: { summary: "Get a project", responses: { "200": okResponse, "404": errorResponse } },
			patch: { summary: "Update a project", responses: { "200": okResponse, "404": errorResponse } },
			delete: { summary: "Delete a project and its resources", responses: { "200": okResponse } },
		},
		"/projects/{id}/webhook-token": {
			parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
			post: { summary: "Regenerate the project deploy webhook token", responses: { "200": okResponse } },
		},
		"/projects/by-tag/{tag}/deploy": {
			parameters: [{ name: "tag", in: "path", required: true, schema: { type: "string" } }],
			post: { summary: "Deploy every project with a tag", responses: { "201": okResponse } },
		},
		"/webhooks/deploy/{token}": {
			parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
			post: {
				summary: "Public deploy webhook",
				security: [],
				requestBody: {
					required: false,
					content: { "application/json": { schema: { type: "object", properties: { branch: { type: "string" } } } } },
				},
				responses: { "201": okResponse, "404": errorResponse },
			},
		},
		"/deployments": {
			get: { summary: "List deployments", responses: { "200": okResponse } },
			post: {
				summary: "Create a deployment (multipart form)",
				requestBody: {
					required: true,
					content: {
						"multipart/form-data": {
							schema: {
								type: "object",
								properties: {
									projectId: { type: "string" },
									sourceType: { type: "string", enum: ["git", "upload", "compose", "image"] },
									gitUrl: { type: "string" },
									imageRef: { type: "string" },
									branch: { type: "string" },
									archive: { type: "string", format: "binary" },
								},
							},
						},
					},
				},
				responses: { "201": okResponse, "400": errorResponse },
			},
		},
		"/deployments/{id}/rollback": {
			parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
			post: { summary: "Roll back to a deployment", responses: { "200": okResponse, "400": errorResponse } },
		},
		"/registries": {
			get: { summary: "List image registries", responses: { "200": okResponse } },
			post: { summary: "Create an image registry", responses: { "201": okResponse } },
		},
		"/notifications": {
			get: { summary: "List notification channels", responses: { "200": okResponse } },
			post: { summary: "Create a notification channel", responses: { "201": okResponse } },
		},
		"/audit-logs": {
			get: {
				summary: "List audit log entries",
				parameters: [
					{ name: "resourceType", in: "query", schema: { type: "string" } },
					{ name: "action", in: "query", schema: { type: "string" } },
					{ name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
					{ name: "offset", in: "query", schema: { type: "integer" } },
				],
				responses: { "200": okResponse },
			},
		},
		"/api-keys": {
			get: { summary: "List API keys", responses: { "200": okResponse } },
			post: { summary: "Create an API key", responses: { "201": okResponse } },
		},
	},
};

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Dequel API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:"/api/openapi.json",dom_id:"#swagger-ui",deepLinking:true});</script>
</body></html>`;

export const openApiRoutes = new Elysia()
	.get("/openapi.json", () => spec)
	.get("/docs", ({ set }) => {
		set.headers["content-type"] = "text/html";
		return html;
	});
