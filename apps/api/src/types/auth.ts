export interface GithubIntegration {
	id: string;
	clientId: string;
	clientSecret: string;
	appName: string;
	webhookSecret: string | null;
	createdAt: string;
}

export interface ApiKey {
	id: string;
	name: string;
	keyHash: string;
	permissions: string;
	projectId: string | null;
	pausedAt: string | null;
	createdAt: string;
	lastUsedAt: string | null;
}

export interface CreateApiKeyInput {
	name: string;
	permissions?: string;
	projectId?: string | null;
}

export interface Permission {
	action: string;
	resource: string;
}

export interface AuthContext {
	type: "session" | "api-key";
	apiKeyId?: string;
	permissions?: Permission[];
}
