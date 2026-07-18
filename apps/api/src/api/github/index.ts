import { Elysia } from "elysia";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getGithubIntegration, setGithubIntegration, createDeployment, listProjects } from "../../db/repo";
import { orchestrator } from "../../orchestrator";
import { config } from "../../utils/config";

const SESSIONS_FILE = join(process.env.DATA_DIR ?? "./data", ".github-sessions.json");

let SESSIONS = new Map<string, { token: string }>();

const loadSessions = () => {
	try {
		const raw = readFileSync(SESSIONS_FILE, "utf-8");
		const entries: [string, { token: string }][] = JSON.parse(raw);
		SESSIONS = new Map(entries);
	} catch {}
};

const saveSessions = () => {
	try {
		const dir = SESSIONS_FILE.substring(0, SESSIONS_FILE.lastIndexOf("/"));
		mkdirSync(dir, { recursive: true });
		writeFileSync(SESSIONS_FILE, JSON.stringify([...SESSIONS]), "utf-8");
	} catch {}
};

loadSessions();

const validateToken = async (token: string): Promise<boolean> => {
	try {
		const res = await fetch("https://api.github.com/user", {
			headers: { Authorization: `Bearer ${token}`, "User-Agent": "dequel" },
		});
		return res.ok;
	} catch {
		return true;
	}
};

const getSession = async (cookie: string | null): Promise<string | null> => {
	if (!cookie) return null;
	const match = cookie.match(/github_session=([^;]+)/);
	if (!match) return null;
	const session = SESSIONS.get(match[1]);
	if (!session) return null;
	const valid = await validateToken(session.token);
	if (!valid) {
		SESSIONS.delete(match[1]);
		saveSessions();
		return null;
	}
	return session.token;
};

const createSession = (token: string): string => {
	const id = crypto.randomUUID();
	SESSIONS.set(id, { token });
	saveSessions();
	return id;
};

const publicUrl = (request: Request): URL => {
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost";
  return new URL(`${proto}://${host}${new URL(request.url).pathname}`);
};

const describeGithubError = (err: unknown): { status: number; message: string } => {
	const raw = err instanceof Error ? err.message : String(err);
	const match = raw.match(/^GitHub API error (\d+): (.*)$/s);
	if (!match) return { status: 502, message: raw };
	const status = Number(match[1]);
	if (status === 403 && /not accessible by integration/i.test(match[2])) {
		return {
			status: 502,
			message: "GitHub App is missing the 'Webhooks' repository permission. In your GitHub App settings, go to Permissions & events and set Webhooks to Read and write, approve the new permission, then try again.",
		};
	}
	return { status: 502, message: `GitHub API error ${status}: ${match[2]}` };
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
		const url = publicUrl(request);
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
		const url = publicUrl(request);
		const origin = url.origin;
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
		set.headers["Set-Cookie"] = `github_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=315360000`;
		set.headers["Location"] = `${origin}/?github=connected`;
	})

	.get("/user", async ({ request, set }) => {
		const token = await getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		return fetchGitHub("/user", token);
	})

	.get("/repos", async ({ request, set }) => {
		const token = await getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		const allRepos: any[] = [];
		let page = 1;
		while (page <= 10) {
			const repos = await fetchGitHub(`/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner`, token);
			if (!Array.isArray(repos) || repos.length === 0) break;
			allRepos.push(...repos);
			page++;
		}
		return allRepos.map((r: any) => ({
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
		const token = await getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		try {
			const hooks = await fetchGitHub(`/repos/${params.owner}/${params.repo}/hooks`, token);
			return Array.isArray(hooks) ? hooks.map((h: any) => ({ id: h.id, url: h.config.url, active: h.active, events: h.events })) : [];
		} catch (err) {
			const { status, message } = describeGithubError(err);
			set.status = status;
			return { error: message };
		}
	})

	.post("/repos/:owner/:repo/hook", async ({ request, set, params }) => {
		const token = await getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		const webhookUrl = `${publicUrl(request).origin}/api/github/webhook`;
		const integration = await getGithubIntegration();
		const secret = integration?.webhookSecret || config.githubWebhookSecret;

		try {
			const hooks = await fetchGitHub(`/repos/${params.owner}/${params.repo}/hooks`, token);
			const existing = Array.isArray(hooks) ? hooks.find((h: any) => h.config?.url === webhookUrl) : null;

			if (existing) {
				return { id: existing.id, created: false, url: webhookUrl };
			}

			// Remove stale Dequel webhooks left over from a previous tunnel/domain
			const stale = Array.isArray(hooks)
				? hooks.filter((h: any) => typeof h.config?.url === "string" && h.config.url.endsWith("/api/github/webhook") && h.config.url !== webhookUrl)
				: [];
			for (const h of stale) {
				await fetchGitHubWithBody(`/repos/${params.owner}/${params.repo}/hooks/${h.id}`, token, "DELETE").catch(() => {});
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
		} catch (err) {
			const { status, message } = describeGithubError(err);
			set.status = status;
			return { error: message };
		}
	})

	.delete("/repos/:owner/:repo/hook", async ({ request, set, params }) => {
		const token = await getSession(request.headers.get("cookie"));
		if (!token) {
			set.status = 401;
			return { error: "Not authenticated" };
		}
		const webhookUrl = `${publicUrl(request).origin}/api/github/webhook`;
		let hooks: any;
		try {
			hooks = await fetchGitHub(`/repos/${params.owner}/${params.repo}/hooks`, token);
		} catch (err) {
			const { status, message } = describeGithubError(err);
			set.status = status;
			return { error: message };
		}
		const existing = Array.isArray(hooks) ? hooks.find((h: any) => h.config?.url === webhookUrl) : null;
		if (!existing) {
			return { ok: true, removed: false };
		}
		try {
			await fetchGitHubWithBody(`/repos/${params.owner}/${params.repo}/hooks/${existing.id}`, token, "DELETE");
			return { ok: true, removed: true };
		} catch (err) {
			const { status, message } = describeGithubError(err);
			set.status = status;
			return { error: message };
		}
	})

	.post("/disconnect", async ({ set, request }) => {
		const cookie = request.headers.get("cookie");
		const match = cookie?.match(/github_session=([^;]+)/);
		if (match) {
			SESSIONS.delete(match[1]);
			saveSessions();
		}
		set.headers["Set-Cookie"] = "github_session=; Path=/; Max-Age=0";
		return { ok: true };
	})

	.post("/webhook", async ({ request, set }) => {
		const integration = await getGithubIntegration();
		const event = request.headers.get("x-github-event") || "";
		const delivery = request.headers.get("x-github-delivery") || "";
		console.log(`[GitWebhook] received event=${event} delivery=${delivery}`);

		if (!integration?.webhookSecret) {
			console.log("[GitWebhook] rejected: no webhook secret configured on this Dequel instance");
			set.status = 400;
			return { error: "GitHub webhook not configured" };
		}

		const signature = request.headers.get("x-hub-signature-256") || "";
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
			console.log(`[GitWebhook] rejected delivery=${delivery}: signature length mismatch (check webhook secret matches Dequel settings)`);
			set.status = 401;
			return { error: "Invalid signature" };
		}
		if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
			console.log(`[GitWebhook] rejected delivery=${delivery}: signature mismatch (check webhook secret matches Dequel settings)`);
			set.status = 401;
			return { error: "Invalid signature" };
		}

		if (event !== "push") {
			console.log(`[GitWebhook] ignored delivery=${delivery}: unsupported event ${event}`);
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

		if (!commitSha || commitSha === "0000000000000000000000000000000000000000") {
			console.log(`[GitWebhook] ignored delivery=${delivery}: deletion event, no commit to deploy`);
			return { ok: true, ignored: "deletion event, no commit to deploy" };
		}

		const projects = await listProjects();
		const normalize = (u: string) => u.replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();
		const matching = projects.filter(p => p.repoUrl && normalize(p.repoUrl) === normalize(repoUrl));

		if (matching.length === 0) {
			console.log(`[GitWebhook] ignored delivery=${delivery}: no project found for repo ${repoUrl}. Known project repos: ${projects.map(p => p.repoUrl).filter(Boolean).join(", ") || "(none)"}`);
			return { ok: true, ignored: `no project found for repo: ${repoUrl}` };
		}

		const targets = matching.filter(p => !p.repoBranch || p.repoBranch === branch);

		if (targets.length === 0) {
			console.log(`[GitWebhook] ignored delivery=${delivery}: branch "${branch}" does not match any project watching ${repoUrl} (branches: ${matching.map(p => p.repoBranch ?? "any").join(", ")})`);
			return { ok: true, ignored: `branch "${branch}" does not match any watching project's branch` };
		}

		const deploymentIds: string[] = [];
		for (const project of targets) {
			const dep = await createDeployment({
				projectId: project.id,
				sourceType: "git",
				sourceRef: repoUrl,
				branch,
				commitSha,
			});
			orchestrator.enqueue(dep.id);
			deploymentIds.push(dep.id);
			console.log(`[GitWebhook] Auto-deploy triggered for ${project.name} (${branch}) — commit ${commitSha.slice(0, 7)}`);
		}

		return { ok: true, deploymentIds };
	});
