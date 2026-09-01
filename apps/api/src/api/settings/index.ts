import { Elysia } from "elysia";
import { getSmtpSettings, upsertSmtpSettings, getPlatformSettings, setIngressServer, getServerById } from "../../db/repo";
import { failoverState } from "../../orchestrator/failover";
import { rerenderAllIngressRoutes } from "../../orchestrator/ingress-sync";
import nodemailer from "nodemailer";
import { ok, fail } from "../response";

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .get("/ingress", async () => {
    const { ingressServerId } = await getPlatformSettings();
    const server = ingressServerId ? await getServerById(ingressServerId) : null;
    const failover = failoverState();
    return ok({ ingressServerId, server: server ?? null, ...failover });
  })

  .put("/ingress", async ({ body, set }: any) => {
    const serverId = body?.serverId ?? null;
    if (serverId) {
      const server = await getServerById(serverId);
      if (!server) {
        set.status = 400;
        return fail("Server not found");
      }
      if (server.mode !== "ssh" && server.mode !== "agent" && server.mode !== "local") {
        set.status = 400;
        return fail("Unsupported server mode for ingress");
      }
    }
    const { ingressServerId: oldId } = await getPlatformSettings();
    if (oldId === serverId) {
      return ok({ ingressServerId: serverId }, "Ingress server unchanged");
    }
    await setIngressServer(serverId);
    await rerenderAllIngressRoutes(oldId, serverId).catch((err) => {
      console.error("[Settings] Ingress rerender failed:", err);
    });
    return ok({ ingressServerId: serverId }, "Ingress server updated");
  })

  .get("/smtp", async ({ set }: any) => {
    const settings = await getSmtpSettings();
    if (!settings) {
      return ok({ configured: false });
    }
    return ok({
      configured: true,
      host: settings.host,
      port: settings.port,
      user: settings.user,
      fromAddress: settings.fromAddress,
    });
  })

  .put("/smtp", async ({ body, set }: any) => {
    if (!body?.host) {
      set.status = 400;
      return fail("host is required");
    }
    await upsertSmtpSettings({
      host: body.host,
      port: body.port ?? 587,
      user: body.user ?? "",
      pass: body.pass ?? "",
      fromAddress: body.fromAddress ?? "dequel@localhost",
    });
    return ok(null, "SMTP settings updated");
  })

  .post("/smtp/test", async ({ set }: any) => {
    const settings = await getSmtpSettings();
    if (!settings || !settings.host) {
      set.status = 400;
      return fail("SMTP not configured");
    }
    try {
      const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.port === 465,
        auth: settings.user && settings.pass
          ? { user: settings.user, pass: settings.pass }
          : undefined,
      });
      await transporter.sendMail({
        from: settings.fromAddress,
        to: settings.fromAddress,
        subject: "[Dequel] SMTP Test Email",
        text: "This is a test email from Dequel. Your SMTP settings are working correctly.",
      });
      return ok(null, "Test email sent");
    } catch (err: any) {
      set.status = 400;
      return fail(err.message);
    }
  })

  .get("/ai", async () => {
    const { getPublicAiSettings } = await import("../../db/repo");
    const settings = await getPublicAiSettings();
    return ok(settings);
  })

  .put("/ai", async ({ body }: any) => {
    const { upsertAiSettings } = await import("../../db/repo");
    await upsertAiSettings({
      defaultProvider: body?.defaultProvider,
      openaiApiKey: body?.openaiApiKey,
      openaiModel: body?.openaiModel,
      geminiApiKey: body?.geminiApiKey,
      geminiModel: body?.geminiModel,
      grokApiKey: body?.grokApiKey,
      grokModel: body?.grokModel,
      claudeApiKey: body?.claudeApiKey,
      claudeModel: body?.claudeModel,
    });
    return ok(null, "AI settings updated");
  })

  .post("/ai/test", async ({ body, set }: any) => {
    const provider = body?.provider || "openai";
    const apiKey = body?.apiKey;
    const model = body?.model;
    const { testAiConnection } = await import("../../ai");
    const result = await testAiConnection(provider, apiKey, model);
    if (!result.ok) {
      set.status = 400;
      return fail(result.message);
    }
    return ok(result);
  });

