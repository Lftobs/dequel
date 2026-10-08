import { Elysia } from "elysia";
import { fail } from "./response";

export interface RateLimitRule {
	windowMs: number;
	max: number;
}

export const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
	"/api/auth/login": { windowMs: 60_000, max: 5 },
	"/api/auth/refresh": { windowMs: 60_000, max: 30 },
	default: { windowMs: 60_000, max: 300 },
};

export const getClientIp = (request: Request): string => {
	const cfIp = request.headers.get("cf-connecting-ip");
	if (cfIp) return cfIp.trim();
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0].trim();
	const realIp = request.headers.get("x-real-ip");
	if (realIp) return realIp.trim();
	return "127.0.0.1";
};

class RateLimiter {
	private stores = new Map<string, number[]>();
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor() {
		this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
		if (this.cleanupInterval?.unref) {
			this.cleanupInterval.unref();
		}
	}

	public check(
		key: string,
		rule: RateLimitRule,
	): {
		allowed: boolean;
		limit: number;
		remaining: number;
		reset: number;
		retryAfter: number;
	} {
		const now = Date.now();
		const windowStart = now - rule.windowMs;
		const timestamps = (this.stores.get(key) ?? []).filter((ts) => ts > windowStart);

		if (timestamps.length >= rule.max) {
			const earliest = timestamps[0] ?? now;
			const reset = Math.ceil((earliest + rule.windowMs) / 1000);
			const retryAfter = Math.max(1, Math.ceil((earliest + rule.windowMs - now) / 1000));
			this.stores.set(key, timestamps);
			return {
				allowed: false,
				limit: rule.max,
				remaining: 0,
				reset,
				retryAfter,
			};
		}

		timestamps.push(now);
		this.stores.set(key, timestamps);
		const earliest = timestamps[0];
		const reset = Math.ceil((earliest + rule.windowMs) / 1000);
		return {
			allowed: true,
			limit: rule.max,
			remaining: rule.max - timestamps.length,
			reset,
			retryAfter: 0,
		};
	}

	public reset(): void {
		this.stores.clear();
	}

	private cleanup(): void {
		const now = Date.now();
		for (const [key, timestamps] of this.stores.entries()) {
			const valid = timestamps.filter((ts) => ts > now - 60_000);
			if (valid.length === 0) {
				this.stores.delete(key);
			} else {
				this.stores.set(key, valid);
			}
		}
	}
}

export const rateLimiter = new RateLimiter();

export const rateLimitMiddleware = (app: Elysia) =>
	app.onBeforeHandle(async ({ request, set, path }) => {
		if (process.env.NODE_ENV === "test" && process.env.TEST_RATE_LIMIT !== "true") {
			return;
		}

		const ip = getClientIp(request);
		const rule = RATE_LIMIT_RULES[path] ?? RATE_LIMIT_RULES.default;
		const key = `${path}:${ip}`;

		const result = rateLimiter.check(key, rule);

		set.headers["RateLimit-Limit"] = String(result.limit);
		set.headers["RateLimit-Remaining"] = String(result.remaining);
		set.headers["RateLimit-Reset"] = String(result.reset);

		if (!result.allowed) {
			set.status = 429;
			set.headers["Retry-After"] = String(result.retryAfter);
			return fail("Too many requests, please try again later");
		}
	});
