import { Elysia } from "elysia";
import { ok } from "../response";

export const healthRoutes = new Elysia()
	.get("/health", () => ok({ service: "dequel-api" }));
