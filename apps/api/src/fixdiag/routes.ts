import { Elysia } from "elysia";
import { findCompletedAction } from "../db/repo/diag-actions";
import { getDiagRun, listActiveDiagRuns, listStageResults } from "../db/repo/diag-runs";
import { created, fail, ok } from "../api/response";
import { approveFixPr, approveSlackPost } from "./actions";
import { DiagRunMachine } from "./machine";
import { diagBus } from "./stream";
import type { StageEvent } from "./types";

export const fixdiagRoutes = new Elysia()
	.post("/deployments/:id/diagnose", async ({ params: { id }, body, set }: any) => {
		const started = await DiagRunMachine.start({
			deploymentId: String(id),
			provider: String(body?.provider ?? ""),
			model: String(body?.model ?? ""),
		});
		if (!started.ok) {
			set.status = started.status;
			return fail(started.message);
		}
		if (started.created) {
			void DiagRunMachine.drive(started.run.id).catch((err) => {
				console.error("[Fixdiag] Drive failed:", err);
			});
			return created(started.run, "Diagnosis started");
		}
		if (started.run.status === "running") {
			void DiagRunMachine.drive(started.run.id).catch((err) => {
				console.error("[Fixdiag] Drive failed:", err);
			});
		}
		return ok(started.run, "Diagnosis already exists");
	})
	.get("/diagnoses/active", async () => ok(await listActiveDiagRuns()))
	.get("/diagnoses/:id", async ({ params: { id }, set }: any) => {
		const run = await getDiagRun(String(id));
		if (!run) {
			set.status = 404;
			return fail("Diagnosis not found");
		}
		const slack = await findCompletedAction(run.id, "slack").catch(() => null);
		return ok({ run, stages: await listStageResults(run.id), slackPosted: !!slack });
	})
	.post("/diagnoses/:id/approve-pr", async ({ params: { id }, body, request, set }: any) => {
		const res = await approveFixPr(String(id), String(body?.idempotencyKey ?? ""), request.headers.get("cookie"));
		if (!res.ok) {
			set.status = res.status;
			return fail(res.message);
		}
		return ok(res.data, "Fix PR created");
	})
	.post("/diagnoses/:id/approve-slack", async ({ params: { id }, body, set }: any) => {
		const res = await approveSlackPost(String(id), String(body?.idempotencyKey ?? ""));
		if (!res.ok) {
			set.status = res.status;
			return fail(res.message);
		}
		return ok(res.data, "Report posted to Dequel Slack");
	})
	.get("/diagnoses/:id/stream", async ({ params: { id }, request, set }: any) => {
		const run = await getDiagRun(String(id));
		if (!run) {
			set.status = 404;
			return fail("Diagnosis not found");
		}
		const encoder = new TextEncoder();
		let unsubscribe: () => void = () => {};
		let heartbeat: ReturnType<typeof setInterval> | null = null;
		let closed = false;
		const stop = () => {
			if (closed) return;
			closed = true;
			unsubscribe();
			if (heartbeat) clearInterval(heartbeat);
		};
		const runId = run.id;
		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				const send = (eventName: string, payload: unknown) => {
					if (closed) return;
					controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`));
				};
				const handle = (event: StageEvent) => {
					if (closed) return;
					if (event.type === "stage") send("stage", event);
					else if (event.type === "done") {
						send("done", event);
						stop();
						controller.close();
					} else if (event.type === "error") {
						send("error", event);
						stop();
						controller.close();
					}
				};
				send("ready", { runId });
				const buffered: StageEvent[] = [];
				let replaying = true;
				unsubscribe = diagBus.subscribe(runId, (event) => {
					if (event.type === "token") return;
					if (replaying) buffered.push(event);
					else handle(event);
				});
				for (const stage of await listStageResults(runId)) {
					send("stage", { runId, stage: stage.stage, payload: stage.payload });
				}
				replaying = false;
				for (const event of buffered) handle(event);
				if (closed) return;
				const latest = (await getDiagRun(runId)) ?? run;
				if (closed) return;
				if (latest.status === "done") {
					send("done", { runId });
					stop();
					controller.close();
					return;
				}
				if (latest.status === "error") {
					send("error", { runId, message: latest.error });
					stop();
					controller.close();
					return;
				}
				heartbeat = setInterval(() => send("heartbeat", { at: new Date().toISOString() }), 15000);
			},
			cancel: stop,
		});
		request.signal.addEventListener("abort", stop, { once: true });
		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	});
