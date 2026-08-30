import { Elysia } from "elysia";
import { ok } from "../response";

export const serverInfoRoutes = new Elysia().get(
	"/server/ip",
	async () => {
		const { checkBaseDomainStatus } = await import("../../utils/dns");
		return ok(await checkBaseDomainStatus());
	},
);
