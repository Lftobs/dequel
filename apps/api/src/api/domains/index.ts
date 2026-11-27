import { promises as dns } from "node:dns";
import { Elysia } from "elysia";
import {
	createDomain,
	deleteDomain,
	getDomainById,
	getProjectById,
	listDomains,
	updateDomainSettings,
	updateDomainValidation,
} from "../../db/repo";
import { isPort, SERVICE_NAME_RE } from "../../utils/validate";
import { auditRequest } from "../audit";
import { created, fail, ok } from "../response";

const PRIVATE_IP_RANGES = [
	/^10\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^127\./,
	/^169\.254\./,
	/^::1$/,
	/^fc00:/,
	/^fe80:/,
];

const isPrivateIp = (ip: string): boolean => PRIVATE_IP_RANGES.some((re) => re.test(ip));

const checkDns = async (domain: string): Promise<{ ok: boolean; ip?: string }> => {
	try {
		const ips = await dns.resolve4(domain);
		const publicIp = ips.find((ip) => !isPrivateIp(ip));
		if (!publicIp) return { ok: false };
		return { ok: true, ip: publicIp };
	} catch {
		return { ok: false };
	}
};

const checkTls = async (domain: string): Promise<boolean> => {
	try {
		const res = await fetch(`https://${domain}`, {
			method: "HEAD",
			signal: AbortSignal.timeout(5000),
			redirect: "error",
		});
		return res.ok || res.status < 500;
	} catch {
		return false;
	}
};

export const domainsRoutes = new Elysia()
	.get("/projects/:id/domains", async ({ params }) => ok(await listDomains(params.id)))
	.get("/projects/:id/domains/status", async ({ params, set }) => {
		const project = await getProjectById(params.id);
		if (!project) {
			set.status = 404;
			return fail("Project not found");
		}
		const domains = await listDomains(params.id);
		const results = await Promise.all(
			domains.map(async (d) => {
				const [dnsResult, tlsOk] = await Promise.all([checkDns(d.domain), checkTls(d.domain)]);
				return {
					domain: d.domain,
					dnsOk: dnsResult.ok,
					tlsOk,
					serverIp: dnsResult.ip ?? null,
					lastChecked: new Date().toISOString(),
				};
			}),
		);
		return ok(results);
	})
	.post("/projects/:id/domains", async ({ params, body, request, set }: any) => {
		if (!body?.domain) {
			set.status = 400;
			return fail("domain is required");
		}
		if (body.targetService && !SERVICE_NAME_RE.test(String(body.targetService))) {
			set.status = 400;
			return fail("targetService may only contain letters, numbers, underscores and hyphens");
		}
		const targetPort = body.targetPort ? Number(body.targetPort) : null;
		if (targetPort !== null && !isPort(targetPort)) {
			set.status = 400;
			return fail("targetPort must be an integer between 1 and 65535");
		}
		if (body.tlsMode && !["auto", "custom", "dns"].includes(body.tlsMode)) {
			set.status = 400;
			return fail("tlsMode must be auto, custom, or dns");
		}
		if (body.tlsMode === "custom" && (!body.certificate || !body.certificateKey)) {
			set.status = 400;
			return fail("certificate and certificateKey are required for custom TLS");
		}
		if (body.basicAuthUser && !body.basicAuthPassword) {
			set.status = 400;
			return fail("basicAuthPassword is required when basicAuthUser is set");
		}
		const domain = await createDomain({
			projectId: params.id,
			domain: body.domain,
			type: body.type ?? "custom",
			targetService: body.targetService || null,
			targetPort,
			cloudflareProxied: Boolean(body.cloudflareProxied),
			tlsMode: body.tlsMode ?? "auto",
			certificate: body.certificate || null,
			certificateKey: body.certificateKey || null,
			basicAuthUser: body.basicAuthUser || null,
			basicAuthPassword: body.basicAuthPassword || null,
			httpsRedirect: body.httpsRedirect ?? true,
			gzip: body.gzip ?? true,
			noindex: Boolean(body.noindex),
			wwwRedirect: Boolean(body.wwwRedirect),
			pathPrefix: body.pathPrefix || null,
			stripPrefix: Boolean(body.stripPrefix),
			rawSnippet: body.rawSnippet || null,
		});
		const { validateDomain, resolveServerIp } = await import("../../utils/dns");
		const project = await getProjectById(params.id);
		resolveServerIp().then((ip) => {
			if (!ip) return;
			validateDomain(body.domain, ip, project?.baseDomain).then((valid) => {
				if (valid) {
					updateDomainValidation(domain.id, "verified", "provisioned");
					import("../../utils/domain-verifier").then((m) =>
						m.addToCaddyRoute(body.domain, params.id, project?.name ?? ""),
					);
				}
			});
		});
		await auditRequest(request, {
			action: "domain.created",
			resourceType: "domain",
			resourceId: domain.id,
			details: { domain: domain.domain, projectId: params.id, tlsMode: domain.tlsMode },
		});
		return created(domain);
	})
	.get("/domains/:id", async ({ params: { id }, set }) => {
		const domain = await getDomainById(id);
		if (!domain) {
			set.status = 404;
			return fail("Domain not found");
		}
		return ok(domain);
	})
	.post("/domains/:id/verify", async ({ params: { id }, set }) => {
		const domain = await getDomainById(id);
		if (!domain) {
			set.status = 404;
			return fail("Domain not found");
		}
		const { validateDomain, resolveServerIp } = await import("../../utils/dns");
		const project = await getProjectById(domain.projectId);
		const ip = await resolveServerIp();
		if (!ip) {
			set.status = 500;
			return fail("Could not determine server IP");
		}
		const valid = await validateDomain(domain.domain, ip, project?.baseDomain);
		const validationStatus = valid ? "verified" : "failed";
		await updateDomainValidation(id, validationStatus, valid ? "provisioned" : "pending");
		if (valid) {
			const { addToCaddyRoute } = await import("../../utils/domain-verifier");
			await addToCaddyRoute(domain.domain, domain.projectId, project?.name ?? "");
		}
		return ok({
			domain: domain.domain,
			validationStatus,
			serverIp: ip,
		});
	})
	.patch("/domains/:id", async ({ params: { id }, body, request, set }: any) => {
		const existing = await getDomainById(id);
		if (!existing) {
			set.status = 404;
			return fail("Domain not found");
		}
		if (body?.tlsMode && !["auto", "custom", "dns"].includes(body.tlsMode)) {
			set.status = 400;
			return fail("tlsMode must be auto, custom, or dns");
		}
		if (body?.targetPort) {
			const port = Number(body.targetPort);
			if (!isPort(port)) {
				set.status = 400;
				return fail("targetPort must be an integer between 1 and 65535");
			}
		}
		const updated = await updateDomainSettings(id, {
			targetService: body?.targetService,
			targetPort: body?.targetPort ? Number(body.targetPort) : body?.targetPort === null ? null : undefined,
			cloudflareProxied: body?.cloudflareProxied,
			tlsMode: body?.tlsMode,
			certificate: body?.certificate,
			certificateKey: body?.certificateKey,
			basicAuthUser: body?.basicAuthUser,
			basicAuthPassword: body?.basicAuthPassword,
			httpsRedirect: body?.httpsRedirect,
			gzip: body?.gzip,
			noindex: body?.noindex,
			wwwRedirect: body?.wwwRedirect,
			pathPrefix: body?.pathPrefix,
			stripPrefix: body?.stripPrefix,
			rawSnippet: body?.rawSnippet,
		});
		const project = await getProjectById(existing.projectId);
		if (project) {
			const { addToCaddyRoute } = await import("../../utils/domain-verifier");
			await addToCaddyRoute(existing.domain, project.id, project.name).catch(() => {});
		}
		await auditRequest(request, {
			action: "domain.updated",
			resourceType: "domain",
			resourceId: id,
			details: { domain: existing.domain, fields: Object.keys(body ?? {}) },
		});
		return ok(updated);
	})
	.delete("/domains/:id", async ({ params: { id }, request, set }) => {
		const domain = await getDomainById(id);
		if (!domain) {
			set.status = 404;
			return fail("Domain not found");
		}
		const { removeFromCaddyRoute } = await import("../../utils/domain-verifier");
		const project = await getProjectById(domain.projectId);
		await deleteDomain(id);
		if (project) removeFromCaddyRoute(domain.domain, project.id, project.name);
		await auditRequest(request, {
			action: "domain.deleted",
			resourceType: "domain",
			resourceId: id,
			details: { domain: domain.domain, projectId: domain.projectId },
		});
		return ok(null, "Domain deleted");
	});
