const BASE = "/api";

export class AuthError extends Error {
	status: number;
	constructor(msg: string, status: number) {
		super(msg);
		this.status = status;
	}
}

export interface MeResponse {
	authenticated: boolean;
	username?: string;
	expiresIn?: number;
}

export interface LoginResponse {
	username: string;
	expiresIn?: number;
}

let refreshPromise: Promise<boolean> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let tokenExpiresAt = 0;

const authChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("dequel_auth") : null;

export const cancelTokenRefresh = () => {
	if (refreshTimer) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
	tokenExpiresAt = 0;
};

export const scheduleTokenRefresh = (expiresInSeconds: number) => {
	cancelTokenRefresh();
	if (expiresInSeconds <= 0) return;

	tokenExpiresAt = Date.now() + expiresInSeconds * 1000;

	const leadTimeSeconds = 120;
	const delaySeconds = Math.max(expiresInSeconds - leadTimeSeconds, 5);

	refreshTimer = setTimeout(() => {
		void doRefreshToken();
	}, delaySeconds * 1000);
};

export const doRefreshToken = async (): Promise<boolean> => {
	if (refreshPromise) {
		return refreshPromise;
	}

	refreshPromise = (async () => {
		try {
			const res = await fetch(`${BASE}/auth/refresh`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				cancelTokenRefresh();
				return false;
			}
			const json = await res.json();
			const data = (json && typeof json === "object" && "data" in json ? json.data : json) as LoginResponse;
			const expiresIn = data?.expiresIn ?? 900;
			scheduleTokenRefresh(expiresIn);
			authChannel?.postMessage({ type: "session_refreshed", expiresIn });
			return true;
		} catch {
			return false;
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
};

const checkAndRefreshIfExpiring = () => {
	if (tokenExpiresAt <= 0) return;
	const remainingMs = tokenExpiresAt - Date.now();
	if (remainingMs <= 120_000) {
		void doRefreshToken();
	}
};

if (typeof window !== "undefined") {
	window.addEventListener("focus", checkAndRefreshIfExpiring);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") {
			checkAndRefreshIfExpiring();
		}
	});
}

if (authChannel) {
	authChannel.onmessage = (event) => {
		if (event.data?.type === "session_refreshed" && typeof event.data.expiresIn === "number") {
			scheduleTokenRefresh(event.data.expiresIn);
		} else if (event.data?.type === "session_logged_out") {
			cancelTokenRefresh();
		}
	};
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
	const res = await fetch(`${BASE}/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({ message: res.statusText }));
		throw new AuthError(body.message ?? body.error ?? "Login failed", res.status);
	}
	const json = await res.json();
	const data = (json && typeof json === "object" && "data" in json ? json.data : json) as LoginResponse;
	const expiresIn = data?.expiresIn ?? 900;
	scheduleTokenRefresh(expiresIn);
	authChannel?.postMessage({ type: "session_refreshed", expiresIn });
	return data;
};

export const logout = async (): Promise<void> => {
	cancelTokenRefresh();
	authChannel?.postMessage({ type: "session_logged_out" });
	await fetch(`${BASE}/auth/logout`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
	});
};

export const refreshSession = async (): Promise<{ username: string }> => {
	const ok = await doRefreshToken();
	if (!ok) {
		throw new AuthError("Failed to refresh session", 401);
	}
	return { username: "" };
};

export const getMe = async (): Promise<MeResponse> => {
	const fetchMe = async (): Promise<MeResponse> => {
		const res = await fetch(`${BASE}/auth/me`);
		if (!res.ok) {
			return { authenticated: false };
		}
		const json = await res.json();
		return (json && typeof json === "object" && "data" in json ? json.data : json) as MeResponse;
	};

	const initial = await fetchMe();
	if (initial.authenticated) {
		scheduleTokenRefresh(initial.expiresIn ?? 900);
		return initial;
	}

	const refreshed = await doRefreshToken();
	if (refreshed) {
		const second = await fetchMe();
		if (second.authenticated) {
			scheduleTokenRefresh(second.expiresIn ?? 900);
		}
		return second;
	}

	cancelTokenRefresh();
	return initial;
};
