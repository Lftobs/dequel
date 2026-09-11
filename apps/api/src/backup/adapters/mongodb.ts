import type { Readable } from "node:stream";
import type { BackupAdapter, BackupContext } from "../adapter";
import { dockerExecStream, dockerExecWithStdin, dockerExec } from "../../utils/docker-run";

export const mongoAdapter: BackupAdapter = {
	engine: "mongodb",

	async dump(ctx: BackupContext): Promise<Readable> {
		return dockerExecStream(
			ctx.target.containerName,
			[
				"mongodump",
				"--uri",
				`mongodb://${ctx.target.credentials.username}:${ctx.target.credentials.password}@localhost:27017/${ctx.target.databaseName}?authSource=admin`,
				"--archive",
			],
			ctx.server,
		);
	},

	async restore(ctx: BackupContext, data: Readable): Promise<void> {
		await dockerExecWithStdin(
			ctx.target.containerName,
			[
				"mongorestore",
				"--uri",
				`mongodb://${ctx.target.credentials.username}:${ctx.target.credentials.password}@localhost:27017/${ctx.target.databaseName}?authSource=admin`,
				"--archive",
				"--drop",
			],
			data,
			ctx.server,
		);
	},

	async ping(ctx: BackupContext): Promise<boolean> {
		try {
			const result = await dockerExec(
				ctx.target.containerName,
				["mongosh", "--eval", "db.adminCommand('ping')"],
				ctx.server,
			);
			return result.code === 0;
		} catch {
			return false;
		}
	},
};
