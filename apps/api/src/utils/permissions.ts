import type { Permission } from "../types";

export const parsePermissions = (raw: string | null | undefined): Permission[] => {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			return parsed.filter(
				(p): p is Permission =>
					typeof p === "object" && p !== null && typeof p.action === "string" && typeof p.resource === "string",
			);
		}
	} catch {}
	return [{ action: raw, resource: "*" }];
};

export const hasPermission = (permissions: Permission[], requiredAction: string, resource?: string): boolean => {
	if (permissions.some((p) => p.action === "*" && p.resource === "*")) return true;
	return permissions.some((p) => {
		if (p.action !== requiredAction && p.action !== "*") return false;
		if (p.resource === "*") return true;
		if (resource && p.resource === resource) return true;
		return false;
	});
};
