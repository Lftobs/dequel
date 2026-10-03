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
			const authArgs = dbRecord.password ? ["-a", dbRecord.password] : [];
			const script =
				"local keys = redis.call('KEYS', '*'); local res = {}; for i, k in ipairs(keys) do if i > 250 then break end; res[#res+1] = k .. '|||' .. (redis.call('TYPE', k)['ok'] or 'string') end; return res";
			const res = await dockerExec(
				dbRecord.containerName,
				["redis-cli", ...authArgs, "--raw", "EVAL", script, "0"],
				server,
			);
			if (res.code === 0) {
				const lines = res.stdout
					.split("\n")
					.map((l) => l.trim())
					.filter((l) => l.length > 0 && !l.startsWith("Warning:"));
				if (lines.length > 0) {
					return lines.map((line) => {
						const [name, type] = line.split("|||");
						return { name: name || line, type: type || "string" };
					});
				}
			}

			const fallbackRes = await dockerExec(
				dbRecord.containerName,
				["redis-cli", ...authArgs, "--raw", "KEYS", "*"],
				server,
			);
			if (fallbackRes.code !== 0) return [];
			const keys = fallbackRes.stdout
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l.length > 0 && !l.startsWith("Warning:"));
			return keys.slice(0, 100).map((name) => ({ name, type: "string" }));
		}

		if (dbRecord.type === "mongodb") {
			const evalScript = `
(() => {
    try {
        const names = db.getCollectionNames();
        const res = names.map(name => {
            let count = 0;
            try { count = db[name].estimatedDocumentCount(); } catch {}
            return { name, type: 'collection', rowCount: count };
        });
        return '__DEQUEL_JSON_START__' + EJSON.stringify(res) + '__DEQUEL_JSON_END__';
    } catch (e) {
        return '__DEQUEL_JSON_START__' + EJSON.stringify(db.getCollectionNames().map(name => ({ name, type: 'collection' }))) + '__DEQUEL_JSON_END__';
    }
})()
`;
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
					evalScript,
				],
				server,
			);
			if (res.code === 0) {
				const startIdx = res.stdout.indexOf("__DEQUEL_JSON_START__");
				const endIdx = res.stdout.indexOf("__DEQUEL_JSON_END__");
				if (startIdx !== -1 && endIdx !== -1) {
					try {
						const jsonStr = res.stdout.substring(startIdx + "__DEQUEL_JSON_START__".length, endIdx);
						const list = JSON.parse(jsonStr);
						if (Array.isArray(list)) return list;
					} catch {}
				}
			}
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

function parseRedisCommandArgs(input: string): string[] {
	const regex = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
	const matches = input.match(regex) || [];
	return matches.map((arg) => {
		if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
			return arg.slice(1, -1);
		}
		return arg;
	});
}

const normalizeBson = (obj: any): any => {
	if (obj === null || obj === undefined) return obj;
	if (typeof obj === "object") {
		if (typeof obj.$oid === "string") return obj.$oid;
		if (typeof obj.$date === "string") return obj.$date;
		if (typeof obj.$numberLong === "string") return Number(obj.$numberLong);
		if (Array.isArray(obj)) return obj.map(normalizeBson);
		const clean: Record<string, any> = {};
		for (const [k, v] of Object.entries(obj)) {
			clean[k] = normalizeBson(v);
		}
		return clean;
	}
	return obj;
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
		const rawLines = query
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith("#"));

		if (rawLines.length === 0) {
			return { rows: [], columns: ["command", "result"], executionTimeMs: 0 };
		}

		const results: Record<string, unknown>[] = [];
		for (const line of rawLines) {
			const parts = parseRedisCommandArgs(line);
			if (parts.length === 0) continue;

			const redisArgs = ["redis-cli"];
			if (dbRecord.password) {
				redisArgs.push("-a", dbRecord.password);
			}
			redisArgs.push(...parts);

			const res = await dockerExec(dbRecord.containerName, redisArgs, server);
			const cleanOut = (res.stdout || "").replace(/^Warning: Using a password[^\n]*\n?/gm, "").trim();
			const cleanErr = (res.stderr || "").replace(/^Warning: Using a password[^\n]*\n?/gm, "").trim();
			const output = res.code === 0 ? cleanOut : cleanErr || cleanOut || "ERROR";
			results.push({
				command: line,
				result: output,
			});
		}

		const executionTimeMs = Date.now() - startTime;
		return {
			rows: results,
			columns: ["command", "result"],
			executionTimeMs,
			rawOutput: results.map((r) => `${r.command} => ${r.result}`).join("\n"),
		};
	}

	if (dbRecord.type === "mongodb") {
		const wrappedScript = `
(() => {
    try {
        let __res = (${query});
        if (__res && typeof __res.toArray === 'function') {
            __res = __res.toArray();
        }
        return '__DEQUEL_JSON_START__' + EJSON.stringify(__res) + '__DEQUEL_JSON_END__';
    } catch (e) {
        try {
            let __res2 = eval(${JSON.stringify(query)});
            if (__res2 && typeof __res2.toArray === 'function') {
                __res2 = __res2.toArray();
            }
            return '__DEQUEL_JSON_START__' + EJSON.stringify(__res2) + '__DEQUEL_JSON_END__';
        } catch (e2) {
            return '__DEQUEL_JSON_START__' + EJSON.stringify({ __mongo_error: e2.message || String(e2) }) + '__DEQUEL_JSON_END__';
        }
    }
})()
`;
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
				wrappedScript,
			],
			server,
		);
		const executionTimeMs = Date.now() - startTime;

		if (res.code === 0) {
			const startIdx = res.stdout.indexOf("__DEQUEL_JSON_START__");
			const endIdx = res.stdout.indexOf("__DEQUEL_JSON_END__");
			if (startIdx !== -1 && endIdx !== -1) {
				const jsonStr = res.stdout.substring(startIdx + "__DEQUEL_JSON_START__".length, endIdx);
				try {
					const parsed = JSON.parse(jsonStr);
					if (parsed && typeof parsed === "object" && "__mongo_error" in parsed) {
						throw new Error(parsed.__mongo_error);
					}
					const normalized = normalizeBson(parsed);
					const rows: Record<string, unknown>[] = Array.isArray(normalized)
						? normalized.map((item) => (typeof item === "object" && item !== null ? item : { result: item }))
						: typeof normalized === "object" && normalized !== null
							? [normalized]
							: [{ result: normalized }];

					const colSet = new Set<string>();
					rows.forEach((r) => Object.keys(r).forEach((k) => colSet.add(k)));
					const columns = Array.from(colSet);
					return {
						rows,
						columns: columns.length > 0 ? columns : ["result"],
						executionTimeMs,
						rawOutput: JSON.stringify(normalized, null, 2),
					};
				} catch (e: any) {
					if (e.message && !e.message.includes("JSON")) throw e;
				}
			}
		}

		const fallbackRes = await dockerExec(
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
		if (fallbackRes.code !== 0) {
			throw new Error(fallbackRes.stderr || fallbackRes.stdout || "MongoDB query failed");
		}
		let rows: Record<string, unknown>[] = [];
		try {
			const parsed = JSON.parse(fallbackRes.stdout);
			const norm = normalizeBson(parsed);
			rows = Array.isArray(norm) ? norm : [norm];
		} catch {
			rows = [{ result: fallbackRes.stdout.trim() }];
		}
		const columns = rows.length > 0 ? Object.keys(rows[0]) : ["result"];
		return { rows, columns, executionTimeMs: Date.now() - startTime, rawOutput: fallbackRes.stdout.trim() };
	}

	throw new Error(`Unsupported database type: ${dbRecord.type}`);
};
