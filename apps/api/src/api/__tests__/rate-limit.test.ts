import { beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { RATE_LIMIT_RULES, getClientIp, rateLimitMiddleware, rateLimiter } from "../rate-limit";

describe("Rate Limiting Middleware", () => {
	beforeEach(() => {
		rateLimiter.reset();
		process.env.TEST_RATE_LIMIT = "true";
	});

	it("extracts client IP from headers with priority", () => {
		const req1 = new Request("http://localhost/test", {
			headers: { "x-real-ip": "1.1.1.1", "cf-connecting-ip": "2.2.2.2" },
		});
		expect(getClientIp(req1)).toBe("1.1.1.1");

		const req2 = new Request("http://localhost/test", {
			headers: { "x-forwarded-for": "2.2.2.2, 3.3.3.3" },
		});
		expect(getClientIp(req2)).toBe("2.2.2.2");

		const req3 = new Request("http://localhost/test", {
			headers: { "cf-connecting-ip": "4.4.4.4" },
		});
		expect(getClientIp(req3)).toBe("4.4.4.4");

		const req4 = new Request("http://localhost/test");
		expect(getClientIp(req4)).toBe("127.0.0.1");
	});

	it("enforces rate limits and sets 429 Retry-After headers when exceeded", async () => {
		const app = new Elysia().use(rateLimitMiddleware).post("/api/auth/login", () => ({ success: true }));

		const headers = { "x-real-ip": "198.51.100.1" };

		for (let i = 0; i < RATE_LIMIT_RULES["/api/auth/login"].max; i++) {
			const res = await app.handle(new Request("http://localhost/api/auth/login", { method: "POST", headers }));
			expect(res.status).toBe(200);
			expect(res.headers.get("RateLimit-Limit")).toBe(String(RATE_LIMIT_RULES["/api/auth/login"].max));
		}

		const blocked = await app.handle(new Request("http://localhost/api/auth/login", { method: "POST", headers }));
		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("RateLimit-Remaining")).toBe("0");
		expect(blocked.headers.get("Retry-After")).toBeDefined();
		const body = await blocked.json();
		expect(body.status).toBe("error");
	});
});
