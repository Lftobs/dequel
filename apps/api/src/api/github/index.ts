import { Elysia } from "elysia";
import { getGithubIntegration, setGithubIntegration } from "../../db/repo";
import { config } from "../../utils/config";

const SESSIONS = new Map<string, { token: string; expiresAt: number }>();
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const getSession = (cookie: string | null): string | null => {
	if (!cookie) return null;
	const match = cookie.match(/github_session=([^;]+)/);
	if (!match) return null;
	const session = SESSIONS.get(match[1]);
	if (!session || session.expiresAt < Date.now()) {
		if (session) SESSIONS.delete(match[1]);
		return null;
	}
	return session.token;
};

const createSession = (token: string): string => {
	const id = crypto.randomUUID();
	SESSIONS.set(id, { token, expiresAt: Date.now() + SESSION_TTL_MS });
	return id;
};

const fetchGitHub = async (path: string, token: string) => {
	const res = await fetch(`https://api.github.com${path}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "dequel",
		},
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`GitHub API error ${res.status}: ${err}`);
	}
	return res.json();
};

export const githubRoutes = new Elysia({ prefix: "/github" })
	.get("/integration", async () => {
		const integration = await getGithubIntegration();
		if (!integration) return { configured: false };
		return { configured: true, clientId: integration.clientId, appName: integration.appName, hasWebhookSecret: !!integration.webhookSecret };
	})

	.put("/integration", async ({ body, set }: any) => {
		if (!body?.clientId || !body?.clientSecret) {
			set.status = 400;
			return { error: "clientId and clientSecret are required" };
		}
		await setGithubIntegration({
			clientId: body.clientId,
			clientSecret: body.clientSecret,
			appName: body.appName,
			webhookSecret: body.webhookSecret,
		});
		return { ok: true };
	})
	.get("/auth-url", async ({ request, set }) => {
		const integration = await getGithubIntegration();
		if (!integration) {
			set.status = 400;
			return { error: "GitHub integration not configured" };
		}
		const url = new URL(request.url);
		const redirectUri = `${url.protocol}//${url.host}/api/github/callback`;
		const state = crypto.randomUUID();
		const params = new URLSearchParams({
			client_id: integration.clientId,
			redirect_uri: redirectUri,
			scope: "repo,read:org,admin:repo_hook",
			state,
		});
		return { url: `https://github.com/login/oauth/authorize?${params}` };
	})

	.get("/callback", async ({ query, set }) => {
		const { code, state } = query as Record<string, string>;
		if (!code) {
			set.status = 400;
			return { error: "Missing code parameter" };
		}
		const integration = await getGithubIntegration();
		if (!integration) {
			set.status = 400;
			return { error: "GitHub integration not configured" };
		}
		const url = new URL(config.caddyIngressBase);
		const redirectUri = `${url.protocol}//${url.host}/api/github/callback`;

		const res = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				client_id: integration.clientId,
				client_secret: integration.clientSecret,
				code,
				redirect_uri: redirectUri,
			}),
		});
		const data = await res.json() as Record<string, string>;
		if (data.error) {
			set.status = 400;
			return { error: data.error_description ?? data.error };
		}
		const sessionId = createSession(data.access_token);
		set.headers["Set-Cookie"] = `github_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
		set.redirect = `${config.caddyIngressBase}/?github=connected`;
	})

	.get("/user", async ({ request, set }) => {
		const token = getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		return fetchGitHub("/user", token);
	})

	.get("/repos", async ({ request, set }) => {
		const token = getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		const repos = await fetchGitHub("/user/repos?per_page=100&sort=updated&type=all", token);
		const user = await fetchGitHub("/user", token) as { login: string };
		const orgs = await fetchGitHub("/user/orgs", token) as { login: string }[];
		const allRepos = Array.isArray(repos) ? repos : [];
		const orgRepos: any[] = [];
		for (const org of Array.isArray(orgs) ? orgs : []) {
			try {
				const orgR = await fetchGitHub(`/orgs/${org.login}/repos?per_page=100&sort=updated&type=all`, token);
				if (Array.isArray(orgR)) orgRepos.push(...orgR);
			} catch {}
		}
		const seen = new Set<number>();
		const merged = [...allRepos, ...orgRepos].filter((r) => {
			if (seen.has(r.id)) return false;
			seen.add(r.id);
			return true;
		});
		return merged.map((r: any) => ({
			id: r.id,
			name: r.name,
			fullName: r.full_name,
			cloneUrl: r.clone_url,
			sshUrl: r.ssh_url,
			description: r.description,
			language: r.language,
			private: r.private,
			defaultBranch: r.default_branch,
			owner: { login: r.owner.login, avatarUrl: r.owner.avatar_url },
		}));
	})

	.post("/disconnect", async ({ set, request }) => {
		const cookie = request.headers.get("cookie");
		const match = cookie?.match(/github_session=([^;]+)/);
		if (match) SESSIONS.delete(match[1]);
		set.headers["Set-Cookie"] = "github_session=; Path=/; Max-Age=0";
		return { ok: true };
	});
