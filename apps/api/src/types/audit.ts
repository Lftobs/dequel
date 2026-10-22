export type AuditActorType = "user" | "api_key" | "system";

export interface AuditLog {
	id: string;
	actorType: AuditActorType;
	actorId: string;
	action: string;
	resourceType: string;
	resourceId: string | null;
	details: Record<string, unknown>;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string;
}

export interface CreateAuditLogInput {
	actorType: AuditActorType;
	actorId: string;
	action: string;
	resourceType: string;
	resourceId?: string | null;
	details?: Record<string, unknown>;
	ipAddress?: string | null;
	userAgent?: string | null;
}

export interface ListAuditLogsFilters {
	actorType?: AuditActorType;
	actorId?: string;
	action?: string;
	resourceType?: string;
	resourceId?: string;
	limit?: number;
	offset?: number;
}
