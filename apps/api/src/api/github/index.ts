import { Elysia } from "elysia";
import { getGithubIntegration, setGithubIntegration, createDeployment, listProjects } from "../../db/repo";
import { orchestrator } from "../../orchestrator";
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

const fetchGitHubWithBody = async (path: string, token: string, method: string, body?: unknown) => {
	const res = await fetch(`https://api.github.com${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github.v3+json",
			"Content-Type": "application/json",
			"User-Agent": "dequel",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`GitHub API error ${res.status}: ${err}`);
	}
	if (res.status === 204) return null;
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

	.get("/callback", async ({ request, query, set }) => {
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
		const origin = new URL(request.url).origin;
		const redirectUri = `${origin}/api/github/callback`;

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
			const msg = encodeURIComponent(data.error_description ?? data.error);
			set.status = 302;
			set.headers["Location"] = `${origin}/?github=error=${msg}`;
			return;
		}
		const sessionId = createSession(data.access_token);
		set.status = 302;
		set.headers["Set-Cookie"] = `github_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
		set.headers["Location"] = `${origin}/?github=connected`;
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

	.get("/repos/:owner/:repo/hooks", async ({ request, set, params }) => {
		const token = getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		const hooks = await fetchGitHub(`/repos/${params.owner}/${params.repo}/hooks`, token);
		return Array.isArray(hooks) ? hooks.map((h: any) => ({ id: h.id, url: h.config.url, active: h.active, events: h.events })) : [];
	})

	.post("/repos/:owner/:repo/hook", async ({ request, set, params }) => {
		const token = getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		const webhookUrl = `${config.publicUrl}/api/github/webhook`;
		const integration = await getGithubIntegration();
		const secret = integration?.webhookSecret || config.githubWebhookSecret;

		const hooks = await fetchGitHub(`/repos/${params.owner}/${params.repo}/hooks`, token);
		const existing = Array.isArray(hooks) ? hooks.find((h: any) => h.config?.url === webhookUrl) : null;

		if (existing) {
			return { id: existing.id, created: false, url: webhookUrl };
		}

		const hook = await fetchGitHubWithBody(`/repos/${params.owner}/${params.repo}/hooks`, token, "POST", {
			name: "web",
			active: true,
			events: ["push"],
			config: {
				url: webhookUrl,
				content_type: "json",
				secret,
				insecure_ssl: "0",
			},
		});
		return { id: hook.id, created: true, url: webhookUrl };
	})

	.delete("/repos/:owner/:repo/hook", async ({ request, set, params }) => {
		const token = getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		const webhookUrl = `${config.publicUrl}/api/github/webhook`;
		const hooks = await fetchGitHub(`/repos/${params.owner}/${params.repo}/hooks`, token);
		const existing = Array.isArray(hooks) ? hooks.find((h: any) => h.config?.url === webhookUrl) : null;
		if (!existing) {
			return { ok: true, removed: false };
		}
		await fetchGitHubWithBody(`/repos/${params.owner}/${params.repo}/hooks/${existing.id}`, token, "DELETE");
		return { ok: true, removed: true };
	})

	.post("/disconnect", async ({ set, request }) => {
		const cookie = request.headers.get("cookie");
		const match = cookie?.match(/github_session=([^;]+)/);
		if (match) SESSIONS.delete(match[1]);
		set.headers["Set-Cookie"] = "github_session=; Path=/; Max-Age=0";
		return { ok: true };
	})

	.post("/webhook", async ({ request, set }) => {
		const integration = await getGithubIntegration();
		if (!integration?.webhookSecret) {
			set.status = 400;
			return { error: "GitHub webhook not configured" };
		}

		const signature = request.headers.get("x-hub-signature-256") || "";
		const event = request.headers.get("x-github-event") || "";
		const delivery = request.headers.get("x-github-delivery") || "";
		const rawBody = await request.text();

		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(integration.webhookSecret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const expectedSigRaw = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
		const expectedSig = "sha256=" + Array.from(new Uint8Array(expectedSigRaw)).map(b => b.toString(16).padStart(2, "0")).join("");

		if (signature.length !== expectedSig.length) {
			set.status = 401;
			return { error: "Invalid signature" };
		}
		if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
			set.status = 401;
			return { error: "Invalid signature" };
		}

		if (event !== "push") {
			return { ok: true, ignored: `unsupported event: ${event}` };
		}

		let payload: any;
		try {
			payload = JSON.parse(rawBody);
		} catch {
			set.status = 400;
			return { error: "Invalid JSON payload" };
		}

		const repoUrl = payload?.repository?.clone_url;
		if (!repoUrl) {
			set.status = 400;
			return { error: "Missing repository.clone_url in payload" };
		}

		const branch = payload?.ref?.replace("refs/heads/", "") || "main";
		const commitSha = payload?.after || "";

		const projects = await listProjects();
		const project = projects.find(p =>
			p.repoUrl && (
				p.repoUrl === repoUrl ||
				p.repoUrl.replace(/\.git$/, "") === repoUrl.replace(/\.git$/, "")
			)
		);

		if (!project) {
			return { ok: true, ignored: `no project found for repo: ${repoUrl}` };
		}

		if (project.repoBranch && project.repoBranch !== branch) {
			return { ok: true, ignored: `branch "${branch}" does not match project branch "${project.repoBranch}"` };
		}

		if (!commitSha || commitSha === "0000000000000000000000000000000000000000") {
			return { ok: true, ignored: "deletion event, no commit to deploy" };
		}

		const dep = await createDeployment({
			projectId: project.id,
			sourceType: "git",
			sourceRef: repoUrl,
			branch,
			commitSha,
		});

		orchestrator.enqueue(dep.id);

		console.log(`[GitWebhook] Auto-deploy triggered for ${project.name} (${branch}) — commit ${commitSha.slice(0, 7)}`);

		return { ok: true, deploymentId: dep.id };
	});
