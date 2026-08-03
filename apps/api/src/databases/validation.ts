import { isIP } from "node:net";
import type { CreateDatabaseInput, DatabaseType } from "../types";

const DATABASE_TYPES: DatabaseType[] = ["postgresql", "mysql", "redis", "mongodb"];
const MAX_ALLOWED_CIDRS = 20;
const MAX_CIDR_LENGTH = 64;

export type DatabaseCreateBody = Partial<CreateDatabaseInput> & { type?: string };

export const isSafeDatabaseVersion = (value: string): boolean =>
	/^(?:latest|\d+(?:\.\d+){0,2}(?:-(?:alpine|bookworm|bullseye))?)$/.test(value);

export const isValidCidr = (value: string): boolean => {
	const [address, prefixText, extra] = value.trim().split("/");
	if (extra !== undefined) return false;
	if (isIP(address) !== 4) return false;
	if (prefixText === undefined) return true;
	if (!/^\d+$/.test(prefixText)) return false;
	const prefix = Number(prefixText);
	return prefix >= 0 && prefix <= 32;
};

export const validateDatabaseCreate = (
	body: DatabaseCreateBody,
): { ok: true; input: Omit<CreateDatabaseInput, "projectId"> } | { ok: false; error: string } => {
	if (!body.name?.trim() || body.name.trim().length > 80) {
		return { ok: false, error: "name is required and must be at most 80 characters" };
	}
	if (!body.type || !DATABASE_TYPES.includes(body.type as DatabaseType)) {
		return { ok: false, error: "type must be postgresql, mysql, redis, or mongodb" };
	}
	if (body.version && !isSafeDatabaseVersion(body.version.trim())) {
		return { ok: false, error: "version must be a numeric image version or latest" };
	}

	const cpuLimit = body.cpuLimit == null ? null : Number(body.cpuLimit);
	const memoryLimitMb = body.memoryLimitMb == null ? null : Number(body.memoryLimitMb);
	const storageLimitMb = body.storageLimitMb == null ? null : Number(body.storageLimitMb);
	if (cpuLimit !== null && (!Number.isFinite(cpuLimit) || cpuLimit <= 0 || cpuLimit > 128)) {
		return { ok: false, error: "cpuLimit must be between 0 and 128 cores" };
	}
	if (memoryLimitMb !== null && (!Number.isInteger(memoryLimitMb) || memoryLimitMb < 64)) {
		return { ok: false, error: "memoryLimitMb must be an integer of at least 64" };
	}
	if (storageLimitMb !== null && (!Number.isInteger(storageLimitMb) || storageLimitMb < 64)) {
		return { ok: false, error: "storageLimitMb must be an integer of at least 64" };
	}

	const publicAccess = body.publicAccess !== false;
	const allowPublicAccessFromAnywhere = body.allowPublicAccessFromAnywhere === true;
	const allowedCidrs = Array.isArray(body.allowedCidrs)
		? body.allowedCidrs.map(String).map((value) => value.trim()).filter(Boolean)
		: [];
	if (allowedCidrs.length > MAX_ALLOWED_CIDRS) {
		return { ok: false, error: `allowedCidrs must contain at most ${MAX_ALLOWED_CIDRS} ranges` };
	}
	if (allowedCidrs.some((cidr) => cidr.length > MAX_CIDR_LENGTH || !isValidCidr(cidr))) {
		return { ok: false, error: "allowedCidrs must contain valid IPv4 CIDR ranges" };
	}
	if (publicAccess && !allowPublicAccessFromAnywhere && allowedCidrs.length === 0) {
		return { ok: false, error: "public databases require an allowed CIDR or allowPublicAccessFromAnywhere" };
	}

	return {
		ok: true,
		input: {
			name: body.name.trim(),
			type: body.type as DatabaseType,
			version: body.version?.trim() || undefined,
			cpuLimit,
			memoryLimitMb,
			storageLimitMb,
			publicAccess,
			allowPublicAccessFromAnywhere,
			allowedCidrs,
		},
	};
};
