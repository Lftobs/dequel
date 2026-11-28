import { Elysia } from "elysia";
import {
	blacklistRefreshToken,
	generateRefreshToken,
	signAccessToken,
	storeRefreshToken,
	validateRefreshToken,
	verifyAccessToken,
} from "../../utils/auth";
import { auditRequest } from "../audit";
import { fail, ok } from "../response";

const PAM_AUTH_URL = "http://pam-auth:4567";

const callPam = async (
	username: string,
	password: string,
): Promise<{ ok: boolean; username?: string; error?: string }> => {
	try {
		const res = await fetch(`${PAM_AUTH_URL}/auth`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password }),
			signal: AbortSignal.timeout(5000),
		});
		const data = await res.json();
		return data;
	} catch (_err) {
		return { ok: false, error: "Auth service unavailable" };
	}
};

const SESSION_COOKIE_OPTS = {
	path: "/",
	httpOnly: true,
	sameSite: "lax" as const,
	maxAge: 900,
};

const REFRESH_COOKIE_OPTS = {
	path: "/",
	httpOnly: true,
	sameSite: "strict" as const,
	maxAge: 7 * 24 * 60 * 60,
};

export const authRoutes = new Elysia()
	.derive(({ request }) => {
		const proto = request.headers.get("x-forwarded-proto");
		const isSecure = proto === "https" || request.url.startsWith("https://");
		return { isSecure };
	})
	.post("/auth/login", async ({ body, request, cookie: { dequl_session, dequl_refresh }, set, isSecure }) => {
		const { username, password } = body as { username?: string; password?: string };
		if (!username || !password) {
			set.status = 400;
			return fail("Username and password required");
		}
		const result = await callPam(username, password);
		if (!result.ok) {
			set.status = 401;
			await auditRequest(
				request,
				{ action: "auth.login_failed", resourceType: "session", details: { username } },
				{ type: "user", id: username },
			);
			return fail(result.error || "Authentication failed");
		}
		const accessToken = await signAccessToken(username);
		const refreshToken = generateRefreshToken();
		await storeRefreshToken(username, refreshToken);
		dequl_session.value = accessToken;
		dequl_session.set({ ...SESSION_COOKIE_OPTS, secure: isSecure });
		dequl_refresh.value = refreshToken;
		dequl_refresh.set({ ...REFRESH_COOKIE_OPTS, secure: isSecure });
		await auditRequest(
			request,
			{ action: "auth.login", resourceType: "session", details: { username } },
			{ type: "user", id: username },
		);
		return ok({ username, expiresIn: 900 }, "Logged in");
	})
	.post("/auth/logout", async ({ cookie: { dequl_session, dequl_refresh } }) => {
		const rt = dequl_refresh.value;
		if (rt) {
			try {
				await blacklistRefreshToken(rt);
			} catch {}
		}
		dequl_session.remove();
		dequl_refresh.remove();
		return ok(null, "Logged out");
	})
	.post("/auth/refresh", async ({ cookie: { dequl_session, dequl_refresh }, set, isSecure }) => {
		const rt = dequl_refresh.value;
		if (!rt) {
			set.status = 401;
			return fail("No refresh token");
		}
		const username = await validateRefreshToken(rt);
		if (!username) {
			set.status = 401;
			return fail("Invalid or expired refresh token");
		}
		await blacklistRefreshToken(rt);
		const accessToken = await signAccessToken(username);
		const newRefreshToken = generateRefreshToken();
		await storeRefreshToken(username, newRefreshToken);
		dequl_session.value = accessToken;
		dequl_session.set({ ...SESSION_COOKIE_OPTS, secure: isSecure });
		dequl_refresh.value = newRefreshToken;
		dequl_refresh.set({ ...REFRESH_COOKIE_OPTS, secure: isSecure });
		return ok({ username, expiresIn: 900 }, "Token refreshed");
	})
	.get("/auth/me", async ({ cookie: { dequl_session, dequl_refresh }, isSecure }) => {
		const token = dequl_session.value;
		if (token) {
			const payload = await verifyAccessToken(token);
			if (payload) {
				const current = Math.floor(Date.now() / 1000);
				return ok({
					authenticated: true,
					username: payload.sub,
					expiresIn: Math.max(0, payload.exp - current),
				});
			}
		}
		const rt = dequl_refresh.value;
		if (rt) {
			const username = await validateRefreshToken(rt);
			if (username) {
				await blacklistRefreshToken(rt);
				const accessToken = await signAccessToken(username);
				const newRefreshToken = generateRefreshToken();
				await storeRefreshToken(username, newRefreshToken);
				dequl_session.value = accessToken;
				dequl_session.set({ ...SESSION_COOKIE_OPTS, secure: isSecure });
				dequl_refresh.value = newRefreshToken;
				dequl_refresh.set({ ...REFRESH_COOKIE_OPTS, secure: isSecure });
				return ok({
					authenticated: true,
					username,
					expiresIn: 900,
				});
			}
		}
		return ok({ authenticated: false });
	});
