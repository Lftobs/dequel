import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cancelTokenRefresh, doRefreshToken, getMe, scheduleTokenRefresh } from "../auth";
import { apiFetch } from "../http";

describe("Web Auth & Refresh Flow", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		cancelTokenRefresh();
	});

	afterEach(() => {
		cancelTokenRefresh();
		globalThis.fetch = originalFetch;
	});

	it("doRefreshToken deduplicates concurrent calls to a single network request", async () => {
		let fetchCount = 0;
		globalThis.fetch = mock(async (url: any) => {
			if (String(url).endsWith("/auth/refresh")) {
				fetchCount++;
				await new Promise((r) => setTimeout(r, 10));
				return new Response(JSON.stringify({ status: "success", data: { username: "user", expiresIn: 900 } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response("{}", { status: 404 });
		});

		const [res1, res2, res3] = await Promise.all([doRefreshToken(), doRefreshToken(), doRefreshToken()]);

		expect(res1).toBe(true);
		expect(res2).toBe(true);
		expect(res3).toBe(true);
		expect(fetchCount).toBe(1);
	});

	it("getMe schedules proactive refresh when authenticated", async () => {
		globalThis.fetch = mock(async (url: any) => {
			if (String(url).endsWith("/auth/me")) {
				return new Response(
					JSON.stringify({ status: "success", data: { authenticated: true, username: "user", expiresIn: 900 } }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			return new Response("{}", { status: 404 });
		});

		const res = await getMe();
		expect(res.authenticated).toBe(true);
		expect(res.username).toBe("user");
		expect(res.expiresIn).toBe(900);
	});

	it("apiFetch automatically retries once upon receiving 401 on non-auth routes", async () => {
		let attempts = 0;
		let refreshCalled = false;

		globalThis.fetch = mock(async (url: any, opts: any) => {
			const strUrl = String(url);
			if (strUrl.endsWith("/auth/refresh")) {
				refreshCalled = true;
				return new Response(JSON.stringify({ status: "success", data: { username: "user", expiresIn: 900 } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (strUrl.endsWith("/projects")) {
				attempts++;
				if (attempts === 1) {
					return new Response(JSON.stringify({ status: "error", message: "Authentication required" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}
				return new Response(JSON.stringify({ status: "success", data: [{ id: "proj-1", name: "My App" }] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response("{}", { status: 404 });
		});

		const data = await apiFetch<Array<{ id: string; name: string }>>("/projects");
		expect(refreshCalled).toBe(true);
		expect(attempts).toBe(2);
		expect(data).toHaveLength(1);
		expect(data[0].name).toBe("My App");
	});
});
