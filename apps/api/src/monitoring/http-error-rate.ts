import type { HttpErrorRate } from "../types";
import { buildProjectRequestHostRegex, caddyRequestLogSelector, lokiInstantQuery } from "../utils/loki";

const unavailable = (windowSeconds: number): HttpErrorRate => ({
	source: "loki",
	available: false,
	windowSeconds,
	totalRequests: 0,
	errorRequests: 0,
	errorRate: null,
	byStatus: [],
});

export const parseHttpErrorRate = (result: unknown, windowSeconds: number): HttpErrorRate => {
	if (!Array.isArray(result)) return unavailable(windowSeconds);
	const byStatus: { status: string; count: number }[] = [];
	for (const entry of result as any[]) {
		const status = String(entry?.metric?.status ?? "");
		const count = Number(entry?.value?.[1]);
		if (!status || !Number.isFinite(count)) continue;
		byStatus.push({ status, count });
	}
	const totalRequests = byStatus.reduce((sum, b) => sum + b.count, 0);
	const errorRequests = byStatus.reduce((sum, b) => sum + (Number(b.status) >= 400 ? b.count : 0), 0);
	return {
		source: "loki",
		available: true,
		windowSeconds,
		totalRequests,
		errorRequests,
		errorRate: totalRequests > 0 ? errorRequests / totalRequests : null,
		byStatus,
	};
};

export const getHttpErrorRate = async (projectId: string, windowSeconds: number): Promise<HttpErrorRate> => {
	try {
		const hostRegex = await buildProjectRequestHostRegex(projectId);
		const query = `sum by (status) (count_over_time(${caddyRequestLogSelector(hostRegex)} [${windowSeconds}s]))`;
		const result = await lokiInstantQuery(query);
		if (result === null) return unavailable(windowSeconds);
		return parseHttpErrorRate(result, windowSeconds);
	} catch {
		return unavailable(windowSeconds);
	}
};
