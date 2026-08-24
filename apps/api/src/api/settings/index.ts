import { Elysia } from "elysia";
import { getSmtpSettings, upsertSmtpSettings, getPlatformSettings, setIngressServer, getServerById } from "../../db/repo";
import { failoverState } from "../../orchestrator/failover";
import { rerenderAllIngressRoutes } from "../../orchestrator/ingress-sync";
import nodemailer from "nodemailer";

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .get("/ingress", async () => {
    const { ingressServerId } = await getPlatformSettings();
    const server = ingressServerId ? await getServerById(ingressServerId) : null;
    const failover = failoverState();
    return { ingressServerId, server: server ?? null, ...failover };
  })

  .put("/ingress", async ({ body, set }: any) => {
    const serverId = body?.serverId ?? null;
    if (serverId) {
      const server = await getServerById(serverId);
      if (!server) {
        set.status = 400;
        return { error: "Server not found" };
      }
      if (server.mode !== "ssh" && server.mode !== "agent" && server.mode !== "local") {
        set.status = 400;
        return { error: "Unsupported server mode for ingress" };
      }
    }
    const { ingressServerId: oldId } = await getPlatformSettings();
    await setIngressServer(serverId);
    rerenderAllIngressRoutes(oldId, serverId).catch(() => {});
    return { ok: true, ingressServerId: serverId };
  })

  .get("/smtp", async ({ set }: any) => {
    const settings = await getSmtpSettings();
    if (!settings) {
      return { configured: false };
    }
    return {
      configured: true,
      host: settings.host,
      port: settings.port,
      user: settings.user,
      fromAddress: settings.fromAddress,
    };
  })

  .put("/smtp", async ({ body, set }: any) => {
    if (!body?.host) {
      set.status = 400;
      return { error: "host is required" };
    }
    await upsertSmtpSettings({
      host: body.host,
      port: body.port ?? 587,
      user: body.user ?? "",
      pass: body.pass ?? "",
      fromAddress: body.fromAddress ?? "dequel@localhost",
    });
    return { ok: true };
  })

  .post("/smtp/test", async ({ set }: any) => {
    const settings = await getSmtpSettings();
    if (!settings || !settings.host) {
      set.status = 400;
      return { error: "SMTP not configured" };
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
      return { ok: true };
    } catch (err: any) {
      set.status = 400;
      return { error: err.message };
    }
  });
