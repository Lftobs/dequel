import { promises as dns } from "node:dns";
import { Elysia } from "elysia";
import {
	createDomain,
	deleteDomain,
	getDomainById,
	getProjectById,
	listDomains,
	updateDomainValidation,
} from "../../db/repo";
import { isPort, SERVICE_NAME_RE } from "../../utils/validate";
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
	.post("/projects/:id/domains", async ({ params, body, set }: any) => {
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
		const domain = await createDomain({
			projectId: params.id,
			domain: body.domain,
			type: body.type ?? "custom",
			targetService: body.targetService || null,
			targetPort,
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
	.delete("/domains/:id", async ({ params: { id }, set }) => {
		const domain = await getDomainById(id);
		if (!domain) {
			set.status = 404;
			return fail("Domain not found");
		}
		const { removeFromCaddyRoute } = await import("../../utils/domain-verifier");
		const project = await getProjectById(domain.projectId);
		await deleteDomain(id);
		if (project) removeFromCaddyRoute(domain.domain, project.id, project.name);
		return ok(null, "Domain deleted");
	});
