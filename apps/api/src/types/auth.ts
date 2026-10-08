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
	createdAt: string;
	lastUsedAt: string | null;
}

export interface CreateApiKeyInput {
	name: string;
	permissions?: string;
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
