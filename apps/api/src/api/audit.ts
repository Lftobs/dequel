import { createAuditLog } from "../db/repo";
import type { AuditActorType } from "../types";

type AuditActor = { type: AuditActorType; id: string };

type AuditEntry = {
	action: string;
	resourceType: string;
	resourceId?: string | null;
	details?: Record<string, unknown>;
};

const actorFrom = (request: Request, override?: AuditActor): AuditActor => {
	const attached = (request as any).dequelActor as AuditActor | undefined;
	return override ?? attached ?? { type: "system", id: "system" };
};

const clientMeta = (request: Request) => {
	const forwarded = request.headers.get("x-forwarded-for");
	const ipAddress = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
	const userAgent = request.headers.get("user-agent");
	return { ipAddress, userAgent };
};

export const auditRequest = async (request: Request, entry: AuditEntry, override?: AuditActor): Promise<void> => {
	const actor = actorFrom(request, override);
	const { ipAddress, userAgent } = clientMeta(request);
	try {
		await createAuditLog({
			actorType: actor.type,
			actorId: actor.id,
			action: entry.action,
			resourceType: entry.resourceType,
			resourceId: entry.resourceId ?? null,
			details: entry.details ?? {},
			ipAddress,
			userAgent,
		});
	} catch {
		// audit writes must never break the mutation they describe
	}
};
