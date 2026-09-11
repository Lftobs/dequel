import type { Readable } from "node:stream";
import type { BackupAdapter, BackupContext } from "../adapter";
import { dockerExecStream, dockerExecWithStdin, dockerExec } from "../../utils/docker-run";

export const redisAdapter: BackupAdapter = {
	engine: "redis",

	async dump(ctx: BackupContext): Promise<Readable> {
		return dockerExecStream(
			ctx.target.containerName,
			["redis-cli", "--rdb", "/dev/stdout", "-a", ctx.target.credentials.password],
			ctx.server,
		);
	},

	async restore(ctx: BackupContext, data: Readable): Promise<void> {
		await dockerExecWithStdin(
			ctx.target.containerName,
			["redis-cli", "-a", ctx.target.credentials.password, "DEBUG", "RELOAD"],
			data,
			ctx.server,
		);
	},

	async ping(ctx: BackupContext): Promise<boolean> {
		try {
			const result = await dockerExec(
				ctx.target.containerName,
				["redis-cli", "-a", ctx.target.credentials.password, "ping"],
				ctx.server,
			);
			return result.code === 0;
		} catch {
			return false;
		}
	},
};
