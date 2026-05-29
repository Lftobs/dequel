import { Elysia } from "elysia";

export const serverInfoRoutes = new Elysia().get(
	"/server/ip",
	async () => {
		const { resolveServerIp } = await import("../../utils/dns");
		return { ip: await resolveServerIp() };
	},
);
