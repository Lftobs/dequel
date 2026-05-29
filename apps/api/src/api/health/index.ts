import { Elysia } from "elysia";

export const healthRoutes = new Elysia()
	.get("/health", () => ({
		ok: true,
		service: "dequel-api",
	}));
