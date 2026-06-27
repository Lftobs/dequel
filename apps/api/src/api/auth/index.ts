import { Elysia } from "elysia";
import { signAccessToken, verifyAccessToken, generateRefreshToken, storeRefreshToken, validateRefreshToken, blacklistRefreshToken } from "../../utils/auth";
import { config } from "../../utils/config";

const PAM_AUTH_URL = "http://pam-auth:4567";

const callPam = async (username: string, password: string): Promise<{ ok: boolean; username?: string; error?: string }> => {
  try {
    const res = await fetch(`${PAM_AUTH_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { ok: false, error: "Auth service unavailable" };
  }
};

const SESSION_COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "strict" as const,
  secure: config.caddyBaseDomain !== "localhost",
  maxAge: 900,
};

const REFRESH_COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "strict" as const,
  secure: config.caddyBaseDomain !== "localhost",
  maxAge: 7 * 24 * 60 * 60,
};

export const authRoutes = new Elysia()
  .post("/auth/login", async ({ body, cookie: { dequel_session, dequel_refresh }, set }) => {
    const { username, password } = body as { username?: string; password?: string };
    if (!username || !password) {
      set.status = 400;
      return { error: "Username and password required" };
    }
    const result = await callPam(username, password);
    if (!result.ok) {
      set.status = 401;
      return { error: result.error || "Authentication failed" };
    }
    const accessToken = await signAccessToken(username);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(username, refreshToken);
    dequel_session.value = accessToken;
    dequel_session.set(SESSION_COOKIE_OPTS);
    dequel_refresh.value = refreshToken;
    dequel_refresh.set(REFRESH_COOKIE_OPTS);
    return { ok: true, username };
  })
  .post("/auth/logout", async ({ cookie: { dequel_session, dequel_refresh } }) => {
    const rt = dequel_refresh.value;
    if (rt) {
      try { await blacklistRefreshToken(rt); } catch {}
    }
    dequel_session.remove();
    dequel_refresh.remove();
    return { ok: true };
  })
  .post("/auth/refresh", async ({ cookie: { dequel_session, dequel_refresh }, set }) => {
    const rt = dequel_refresh.value;
    if (!rt) {
      set.status = 401;
      return { error: "No refresh token" };
    }
    const username = await validateRefreshToken(rt);
    if (!username) {
      set.status = 401;
      return { error: "Invalid or expired refresh token" };
    }
    await blacklistRefreshToken(rt);
    const accessToken = await signAccessToken(username);
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(username, newRefreshToken);
    dequel_session.value = accessToken;
    dequel_session.set(SESSION_COOKIE_OPTS);
    dequel_refresh.value = newRefreshToken;
    dequel_refresh.set(REFRESH_COOKIE_OPTS);
    return { ok: true, username };
  })
  .get("/auth/me", async ({ cookie: { dequel_session } }) => {
    const token = dequel_session.value;
    if (!token) return { authenticated: false };
    const payload = await verifyAccessToken(token);
    if (!payload) return { authenticated: false };
    return { authenticated: true, username: payload.sub };
  });
