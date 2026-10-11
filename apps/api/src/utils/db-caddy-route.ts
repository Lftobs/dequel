import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { reloadCaddy } from "../orchestrator/runtime";
import { config } from "./config";

export interface DbRouteRecord {
	internalHost: string;
	type: string;
	publicAccess: boolean;
}

export interface DbRouteOpts {
	routesDir?: string;
	reloadFn?: () => Promise<void>;
	baseDomain?: string;
}

const gatewayBaseDomain = (opts?: DbRouteOpts): string => opts?.baseDomain ?? config.caddyBaseDomain;

export const dbGatewayEligible = (db: DbRouteRecord, opts?: DbRouteOpts): boolean => {
	const base = gatewayBaseDomain(opts);
	return db.publicAccess && db.type !== "mysql" && Boolean(base) && base !== "localhost";
};

export const dbGatewayHost = (db: DbRouteRecord, opts?: DbRouteOpts): string =>
	`${db.internalHost}.${gatewayBaseDomain(opts)}`;

const routePath = (routesDir: string, internalHost: string): string =>
	join(routesDir, `database-${internalHost}.caddy`);

const writeAndReload = async (filePath: string, content: string, reloadFn: () => Promise<void>) => {
	mkdirSync(dirname(filePath), { recursive: true });
	if (existsSync(filePath) && readFileSync(filePath, "utf8") === content) return;
	writeFileSync(filePath, content, "utf8");
	await reloadFn();
};

export const syncDbGatewayRoute = async (db: DbRouteRecord, opts?: DbRouteOpts): Promise<void> => {
	const routesDir = opts?.routesDir ?? config.caddyRoutesDir;
	const reloadFn = opts?.reloadFn ?? reloadCaddy;
	const filePath = routePath(routesDir, db.internalHost);
	try {
		if (!dbGatewayEligible(db, opts)) {
			if (existsSync(filePath)) {
				unlinkSync(filePath);
				await reloadFn();
			}
			return;
		}
		await writeAndReload(filePath, `${dbGatewayHost(db, opts)} {\n\trespond 404\n}\n`, reloadFn);
	} catch (e) {
		console.warn(`Could not sync Caddy route for database ${db.internalHost}:`, e instanceof Error ? e.message : e);
	}
};

export const removeDbGatewayRoute = async (db: DbRouteRecord, opts?: DbRouteOpts): Promise<void> => {
	const routesDir = opts?.routesDir ?? config.caddyRoutesDir;
	const reloadFn = opts?.reloadFn ?? reloadCaddy;
	const filePath = routePath(routesDir, db.internalHost);
	try {
		if (existsSync(filePath)) {
			unlinkSync(filePath);
			await reloadFn();
		}
	} catch (e) {
		console.warn(`Could not remove Caddy route for database ${db.internalHost}:`, e instanceof Error ? e.message : e);
	}
};
