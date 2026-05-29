import { Elysia } from "elysia";

export const prometheusRoutes = new Elysia()
	.get(
		"/prometheus/query",
		async ({ query, set }: any) => {
			const promQuery = query?.query as string | undefined;
			if (!promQuery) {
				set.status = 400;
				return { error: "query parameter required" };
			}
			try {
				const url = `http://prometheus:9090/api/v1/query?query=${encodeURIComponent(
					promQuery,
				)}`;
				const res = await fetch(url);
				return res.json();
			} catch {
				set.status = 502;
				return { error: "Prometheus unavailable" };
			}
		},
	)
	.get(
		"/prometheus/query_range",
		async ({ query, set }: any) => {
			const promQuery = query?.query as string | undefined;
			const start = query?.start as string | undefined;
			const end = query?.end as string | undefined;
			const step = query?.step as string | undefined;
			if (!promQuery || !start || !end || !step) {
				set.status = 400;
				return { error: "query, start, end, and step parameters are required" };
			}
			try {
				const url = `http://prometheus:9090/api/v1/query_range?query=${encodeURIComponent(
					promQuery,
				)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&step=${encodeURIComponent(step)}`;
				const res = await fetch(url);
				return res.json();
			} catch {
				set.status = 502;
				return { error: "Prometheus unavailable" };
			}
		},
	);

