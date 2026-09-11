import type { Readable } from "node:stream";
import type { Server } from "../../types";
import type { BackupTarget, DatabaseType } from "./types";

export interface BackupContext {
	target: BackupTarget;
	server: Server | null;
}

export interface BackupAdapter {
	readonly engine: DatabaseType;

	dump(ctx: BackupContext): Promise<Readable>;

	restore(ctx: BackupContext, data: Readable): Promise<void>;

	ping(ctx: BackupContext): Promise<boolean>;
}
