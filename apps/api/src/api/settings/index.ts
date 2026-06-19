import { Elysia } from "elysia";
import { getSmtpSettings, upsertSmtpSettings } from "../../db/repo";
import nodemailer from "nodemailer";

export const settingsRoutes = new Elysia({ prefix: "/settings" })
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
