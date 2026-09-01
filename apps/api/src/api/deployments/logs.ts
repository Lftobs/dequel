import { Elysia } from "elysia";
import { getDeploymentById, getLogs } from "../../db/repo";
import { logBus } from "../../orchestrator/log-bus";
import { ok, fail } from "../response";

export const deploymentLogsRoutes = new Elysia()
  .get(
    "/deployments/:id/logs",
    async ({ params: { id }, set }) => {
      const deployment = await getDeploymentById(id);
      if (!deployment) {
        set.status = 404;
        return fail("Deployment not found");
      }
      return ok(await getLogs(id));
    },
  )
  .get(
    "/deployments/:id/logs/stream",
    async ({ params: { id }, request, set }) => {
      const deployment = await getDeploymentById(id);
      if (!deployment) {
        set.status = 404;
        return fail("Deployment not found");
      }
      const encoder = new TextEncoder();
      let unsubscribe = () => undefined;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let closed = false;
      const stop = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
      };
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (eventName: string, payload: unknown) => {
            if (closed) return;
            controller.enqueue(
              encoder.encode(
                `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
              ),
            );
          };
          send("ready", { deploymentId: id });
          unsubscribe = logBus.subscribe(id, (event) =>
            send("log", event),
          );
          heartbeat = setInterval(
            () =>
              send("heartbeat", {
                at: new Date().toISOString(),
              }),
            15000,
          );
        },
        cancel: stop,
      });
      request.signal.addEventListener("abort", stop, {
        once: true,
      });
      set.headers["content-type"] = "text/event-stream";
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },
  )
  .get(
    "/deployments/:id/runtime-logs",
    async ({ params: { id }, set }) => {
      const deployment = await getDeploymentById(id);
      if (!deployment) {
        set.status = 404;
        return fail("Deployment not found");
      }
      const { run } = await import("../../orchestrator/runtime");
      const containerName =
        deployment.containerName || `deploy-${id}`;
      try {
        const output = await run("docker", [
          "logs",
          "--tail",
          "200",
          containerName,
        ]);
        const lines = output
          .split("\n")
          .filter(Boolean)
          .map((line, i) => ({
            sequence: i + 1,
            message: line,
            timestamp: new Date().toISOString(),
            stage: "runtime" as const,
          }));
        return ok(lines);
      } catch {
        return ok([]);
      }
    },
  )
  .get(
    "/deployments/:id/runtime-logs/stream",
    async ({ params: { id }, request, set }) => {
      const deployment = await getDeploymentById(id);
      if (!deployment) {
        set.status = 404;
        return fail("Deployment not found");
      }
      const encoder = new TextEncoder();
      const containerName =
        deployment.containerName || `deploy-${id}`;
      let closed = false;
      const stop = () => {
        closed = true;
      };
      request.signal.addEventListener("abort", stop, {
        once: true,
      });
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (eventName: string, payload: unknown) => {
            if (closed) return;
            controller.enqueue(
              encoder.encode(
                `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
              ),
            );
          };
          const { spawn } = await import("node:child_process");
          const child = spawn(
            "docker",
            [
              "logs",
              "--tail",
              "100",
              "--follow",
              containerName,
            ],
            {
              stdio: ["ignore", "pipe", "pipe"],
            },
          );
          let seq = 0;
          child.stdout.on("data", (chunk: Buffer) => {
            const lines = chunk
              .toString()
              .split("\n")
              .filter(Boolean);
            for (const line of lines) {
              seq++;
              send("log", {
                sequence: seq,
                message: line,
                timestamp: new Date().toISOString(),
                stage: "runtime",
              });
            }
          });
          child.stderr.on("data", (chunk: Buffer) => {
            const lines = chunk
              .toString()
              .split("\n")
              .filter(Boolean);
            for (const line of lines) {
              seq++;
              send("log", {
                sequence: seq,
                message: line,
                timestamp: new Date().toISOString(),
                stage: "runtime",
              });
            }
          });
          child.on("close", () =>
            send("close", { reason: "container stopped" }),
          );
          request.signal.addEventListener(
            "abort",
            () => {
              child.kill();
              stop();
            },
            { once: true },
          );
        },
        cancel: stop,
      });
      set.headers["content-type"] = "text/event-stream";
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },
  );
