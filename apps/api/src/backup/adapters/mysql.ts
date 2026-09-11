import type { Readable } from "node:stream";
import type { BackupAdapter, BackupContext } from "../adapter";
import { dockerExecStream, dockerExecWithStdin, dockerExec } from "../../utils/docker-run";

export const mysqlAdapter: BackupAdapter = {
	engine: "mysql",

	async dump(ctx: BackupContext): Promise<Readable> {
		return dockerExecStream(
			ctx.target.containerName,
			[
				"mysqldump",
				"-u",
				ctx.target.credentials.username,
				`-p${ctx.target.credentials.password}`,
				ctx.target.databaseName,
				"--single-transaction",
				"--routines",
				"--triggers",
			],
			ctx.server,
		);
	},

	async restore(ctx: BackupContext, data: Readable): Promise<void> {
		await dockerExecWithStdin(
			ctx.target.containerName,
			["mysql", "-u", ctx.target.credentials.username, `-p${ctx.target.credentials.password}`, ctx.target.databaseName],
			data,
			ctx.server,
		);
	},

	async ping(ctx: BackupContext): Promise<boolean> {
		try {
			const result = await dockerExec(
				ctx.target.containerName,
				["mysqladmin", "-u", ctx.target.credentials.username, `-p${ctx.target.credentials.password}`, "ping"],
				ctx.server,
			);
			return result.code === 0;
		} catch {
			return false;
		}
	},
};
