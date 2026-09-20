import { Elysia } from "elysia";
import {
	blacklistRefreshToken,
	generateRefreshToken,
	signAccessToken,
	storeRefreshToken,
	validateRefreshToken,
	verifyAccessToken,
} from "../../utils/auth";
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
	.post("/auth/login", async ({ body, cookie: { dequel_session, dequel_refresh }, set, isSecure }) => {
		const { username, password } = body as { username?: string; password?: string };
		if (!username || !password) {
			set.status = 400;
			return fail("Username and password required");
		}
		const result = await callPam(username, password);
		if (!result.ok) {
			set.status = 401;
			return fail(result.error || "Authentication failed");
		}
		const accessToken = await signAccessToken(username);
		const refreshToken = generateRefreshToken();
		await storeRefreshToken(username, refreshToken);
		dequel_session.value = accessToken;
		dequel_session.set({ ...SESSION_COOKIE_OPTS, secure: isSecure });
		dequel_refresh.value = refreshToken;
		dequel_refresh.set({ ...REFRESH_COOKIE_OPTS, secure: isSecure });
		return ok({ username }, "Logged in");
	})
	.post("/auth/logout", async ({ cookie: { dequel_session, dequel_refresh } }) => {
		const rt = dequel_refresh.value;
		if (rt) {
			try {
				await blacklistRefreshToken(rt);
			} catch {}
		}
		dequel_session.remove();
		dequel_refresh.remove();
		return ok(null, "Logged out");
	})
	.post("/auth/refresh", async ({ cookie: { dequel_session, dequel_refresh }, set, isSecure }) => {
		const rt = dequel_refresh.value;
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
		dequel_session.value = accessToken;
		dequel_session.set({ ...SESSION_COOKIE_OPTS, secure: isSecure });
		dequel_refresh.value = newRefreshToken;
		dequel_refresh.set({ ...REFRESH_COOKIE_OPTS, secure: isSecure });
		return ok({ username }, "Token refreshed");
	})
	.get("/auth/me", async ({ cookie: { dequel_session } }) => {
		const token = dequel_session.value;
		if (!token) return ok({ authenticated: false });
		const payload = await verifyAccessToken(token);
		if (!payload) return ok({ authenticated: false });
		return ok({ authenticated: true, username: payload.sub });
	});
