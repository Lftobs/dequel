import { Elysia } from "elysia";

export const serverInfoRoutes = new Elysia().get(
	"/server/ip",
	async () => {
		const { checkBaseDomainStatus } = await import("../../utils/dns");
		return await checkBaseDomainStatus();
	},
);
