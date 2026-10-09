import type { Elysia } from "elysia";
import { fail } from "./response";

const BYPASS_PATHS = new Set([
	"/api/auth/login",
	"/api/auth/logout",
	"/api/auth/refresh",
	"/api/auth/me",
	"/api/health",
	"/api/github/callback",
	"/api/github/webhook",
	"/api/agents/register",
	"/api/agents/p2p-sync",
]);

export const authMiddleware = (app: Elysia) =>
	app.onBeforeHandle(async ({ request, set, path }) => {
		if (BYPASS_PATHS.has(path)) return;

		const cookie = request.headers.get("cookie") || "";
		const match = cookie.match(/(?:^|;\s*)dequel_session=([^;]+)/);
		if (match) {
			const { verifyAccessToken } = await import("../utils/auth");
			const payload = await verifyAccessToken(match[1]);
			if (payload) return;
			set.status = 401;
			return fail("Invalid session");
		}

		const authHeader = request.headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.slice(7);
			if (token) {
				const { validateApiKey } = await import("../db/repo");
				const { canPerformMethod, parsePermissions, requiredPermissionForMethod } = await import(
					"../utils/permissions"
				);
				const key = await validateApiKey(token);
				if (!key) {
					set.status = 401;
					return fail("Invalid API key");
				}
				if (!canPerformMethod(parsePermissions(key.permissions), request.method)) {
					set.status = 403;
					return fail(`API key is missing the ${requiredPermissionForMethod(request.method)} scope`);
				}
				return;
			}
		}

		set.status = 401;
		return fail("Authentication required");
	});
