import type { Readable } from "node:stream";
import { dockerExec, dockerExecStream, dockerExecWithStdin } from "../../utils/docker-run";
import type { BackupAdapter, BackupContext } from "../adapter";

export const postgresAdapter: BackupAdapter = {
	engine: "postgresql",

	async dump(ctx: BackupContext): Promise<Readable> {
		return dockerExecStream(
			ctx.target.containerName,
			["pg_dump", "-U", ctx.target.credentials.username, "-d", ctx.target.databaseName, "--no-owner", "--no-acl"],
			ctx.server,
		);
	},

	async restore(ctx: BackupContext, data: Readable): Promise<void> {
		await dockerExec(
			ctx.target.containerName,
			["dropdb", "-U", ctx.target.credentials.username, "--if-exists", ctx.target.databaseName],
			ctx.server,
		);
		await dockerExec(
			ctx.target.containerName,
			[
				"createdb",
				"-U",
				ctx.target.credentials.username,
				"-O",
				ctx.target.credentials.username,
				ctx.target.databaseName,
			],
			ctx.server,
		);
		await dockerExecWithStdin(
			ctx.target.containerName,
			[
				"pg_restore",
				"-U",
				ctx.target.credentials.username,
				"-d",
				ctx.target.databaseName,
				"--no-owner",
				"--no-acl",
				"--clean",
			],
			data,
			ctx.server,
		);
	},

	async ping(ctx: BackupContext): Promise<boolean> {
		try {
			const result = await dockerExec(
				ctx.target.containerName,
				["pg_isready", "-U", ctx.target.credentials.username],
				ctx.server,
			);
			return result.code === 0;
		} catch {
			return false;
		}
	},
};
