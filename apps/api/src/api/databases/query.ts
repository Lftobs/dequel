import { getServerById } from "../../db/repo";
import type { Database } from "../../types";
import { dockerExec } from "../../utils/docker-run";

export interface QueryExecResult {
	rows: Record<string, unknown>[];
	columns: string[];
	affectedRows?: number;
	executionTimeMs: number;
	rawOutput?: string;
}

export interface TableInfo {
	name: string;
	rowCount?: number;
	type?: string;
}

export const getDatabaseTables = async (dbRecord: Database): Promise<TableInfo[]> => {
	if (!dbRecord.containerName) return [];
	const server = dbRecord.serverId ? await getServerById(dbRecord.serverId) : null;
	const startTime = Date.now();

	try {
		if (dbRecord.type === "postgresql") {
			const res = await dockerExec(
				dbRecord.containerName,
				[
					"psql",
					"-U",
					dbRecord.username,
					"-d",
					dbRecord.databaseName,
					"-t",
					"-c",
					"SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;",
				],
				server,
			);
			if (res.code !== 0) return [];
			return res.stdout
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.map((name) => ({ name, type: "table" }));
		}

		if (dbRecord.type === "mysql") {
			const res = await dockerExec(
				dbRecord.containerName,
				["mysql", "-u", dbRecord.username, `-p${dbRecord.password}`, dbRecord.databaseName, "-B", "-e", "SHOW TABLES;"],
				server,
			);
			if (res.code !== 0) return [];
			const lines = res.stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			return lines.slice(1).map((name) => ({ name, type: "table" }));
		}

		if (dbRecord.type === "redis") {
			const res = await dockerExec(dbRecord.containerName, ["redis-cli", "-a", dbRecord.password, "KEYS", "*"], server);
			if (res.code !== 0) return [];
			const keys = res.stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean);
			return keys.slice(0, 50).map((name) => ({ name, type: "key" }));
		}

		if (dbRecord.type === "mongodb") {
			const res = await dockerExec(
				dbRecord.containerName,
				[
					"mongosh",
					"-u",
					dbRecord.username,
					"-p",
					dbRecord.password,
					"--authenticationDatabase",
					"admin",
					dbRecord.databaseName,
					"--quiet",
					"--eval",
					"db.getCollectionNames()",
				],
				server,
			);
			if (res.code !== 0) return [];
			try {
				const names = JSON.parse(res.stdout);
				if (Array.isArray(names)) {
					return names.map((name: string) => ({ name, type: "collection" }));
				}
			} catch {
				return res.stdout
					.replace(/[[\]'"]/g, "")
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
					.map((name) => ({ name, type: "collection" }));
			}
		}

		return [];
	} catch (error) {
		console.error("Failed to list database tables:", error);
		return [];
	}
};

export const executeDatabaseQuery = async (dbRecord: Database, query: string): Promise<QueryExecResult> => {
	if (!dbRecord.containerName) {
		throw new Error("Database container is not active");
	}
	const server = dbRecord.serverId ? await getServerById(dbRecord.serverId) : null;
	const startTime = Date.now();

	if (dbRecord.type === "postgresql") {
		const res = await dockerExec(
			dbRecord.containerName,
			["psql", "-U", dbRecord.username, "-d", dbRecord.databaseName, "-A", "-F", "\t", "-c", query],
			server,
		);
		const executionTimeMs = Date.now() - startTime;

		if (res.code !== 0) {
			throw new Error(res.stderr || res.stdout || "Execution failed");
		}

		const lines = res.stdout.split("\n").filter((line) => line.length > 0);
		if (lines.length === 0) {
			return { rows: [], columns: [], executionTimeMs, rawOutput: res.stdout };
		}

		const lastLine = lines[lines.length - 1];
		let affectedRows: number | undefined;
		if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(lastLine)) {
			const match = lastLine.match(/\((\d+) rows?\)/);
			if (match) affectedRows = Number(match[1]);
		}

		const dataLines = lines.filter((line) => !line.startsWith("(") || !line.endsWith("rows)"));
		if (dataLines.length === 0) {
			return { rows: [], columns: [], affectedRows, executionTimeMs, rawOutput: res.stdout };
		}

		const columns = dataLines[0].split("\t");
		const rows: Record<string, unknown>[] = [];

		for (let i = 1; i < dataLines.length; i++) {
			const values = dataLines[i].split("\t");
			const row: Record<string, unknown> = {};
			columns.forEach((col, idx) => {
				row[col] = values[idx] ?? null;
			});
			rows.push(row);
		}

		return { rows, columns, affectedRows: affectedRows ?? rows.length, executionTimeMs, rawOutput: res.stdout };
	}

	if (dbRecord.type === "mysql") {
		const res = await dockerExec(
			dbRecord.containerName,
			["mysql", "-u", dbRecord.username, `-p${dbRecord.password}`, dbRecord.databaseName, "-B", "-e", query],
			server,
		);
		const executionTimeMs = Date.now() - startTime;

		if (res.code !== 0) {
			throw new Error(res.stderr || res.stdout || "Execution failed");
		}

		const lines = res.stdout.split("\n").filter((line) => line.length > 0);
		if (lines.length === 0) {
			return { rows: [], columns: [], executionTimeMs, rawOutput: res.stdout };
		}

		const columns = lines[0].split("\t");
		const rows: Record<string, unknown>[] = [];

		for (let i = 1; i < lines.length; i++) {
			const values = lines[i].split("\t");
			const row: Record<string, unknown> = {};
			columns.forEach((col, idx) => {
				row[col] = values[idx] ?? null;
			});
			rows.push(row);
		}

		return { rows, columns, affectedRows: rows.length, executionTimeMs, rawOutput: res.stdout };
	}

	if (dbRecord.type === "redis") {
		const parts = query.trim().split(/\s+/);
		const res = await dockerExec(dbRecord.containerName, ["redis-cli", "-a", dbRecord.password, ...parts], server);
		const executionTimeMs = Date.now() - startTime;

		if (res.code !== 0) {
			throw new Error(res.stderr || res.stdout || "Command execution failed");
		}

		const output = res.stdout;
		return {
			rows: [{ result: output }],
			columns: ["result"],
			executionTimeMs,
			rawOutput: output,
		};
	}

	if (dbRecord.type === "mongodb") {
		const res = await dockerExec(
			dbRecord.containerName,
			[
				"mongosh",
				"-u",
				dbRecord.username,
				"-p",
				dbRecord.password,
				"--authenticationDatabase",
				"admin",
				dbRecord.databaseName,
				"--quiet",
				"--eval",
				query,
			],
			server,
		);
		const executionTimeMs = Date.now() - startTime;

		if (res.code !== 0) {
			throw new Error(res.stderr || res.stdout || "MongoDB query failed");
		}

		let rows: Record<string, unknown>[] = [];
		try {
			const parsed = JSON.parse(res.stdout);
			rows = Array.isArray(parsed) ? parsed : [parsed];
		} catch {
			rows = [{ result: res.stdout }];
		}

		const columns = rows.length > 0 ? Object.keys(rows[0]) : ["result"];
		return { rows, columns, executionTimeMs, rawOutput: res.stdout };
	}

	throw new Error(`Unsupported database type: ${dbRecord.type}`);
};
