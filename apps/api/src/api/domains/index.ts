import { Elysia } from "elysia";
import {
	createDomain,
	deleteDomain,
	getDomainById,
	getProjectById,
	listDomains,
	updateDomainValidation,
} from "../../db/repo";

export const domainsRoutes = new Elysia()
	.get(
		"/projects/:id/domains",
		async ({ params }) => listDomains(params.id),
	)
	.post(
		"/projects/:id/domains",
		async ({ params, body, set }: any) => {
			if (!body?.domain) {
				set.status = 400;
				return { error: "domain is required" };
			}
			const domain = await createDomain({
				projectId: params.id,
				domain: body.domain,
				type: body.type ?? "custom",
			});
			const { validateDomain, resolveServerIp } = await import(
				"../../utils/dns",
			);
			const project = await getProjectById(params.id);
			resolveServerIp().then((ip) => {
				if (!ip) return;
				validateDomain(
					body.domain,
					ip,
					project?.baseDomain,
				).then((valid) => {
					if (valid) {
						updateDomainValidation(
							domain.id,
							"verified",
							"provisioned",
						);
						import("../../utils/domain-verifier").then(
							(m) =>
								m.addToCaddyRoute(
									body.domain,
									params.id,
									project?.name ?? "",
								),
						);
					}
				});
			});
			return domain;
		},
	)
	.get(
		"/domains/:id",
		async ({ params: { id }, set }) => {
			const domain = await getDomainById(id);
			if (!domain) {
				set.status = 404;
				return { error: "Domain not found" };
			}
			return domain;
		},
	)
	.post(
		"/domains/:id/verify",
		async ({ params: { id }, set }) => {
			const domain = await getDomainById(id);
			if (!domain) {
				set.status = 404;
				return { error: "Domain not found" };
			}
			const { validateDomain, resolveServerIp } = await import(
				"../../utils/dns",
			);
			const project = await getProjectById(domain.projectId);
			const ip = await resolveServerIp();
			if (!ip) {
				set.status = 500;
				return { error: "Could not determine server IP" };
			}
			const valid = await validateDomain(
				domain.domain,
				ip,
				project?.baseDomain,
			);
			const validationStatus = valid ? "verified" : "failed";
			await updateDomainValidation(
				id,
				validationStatus,
				valid ? "provisioned" : "pending",
			);
			if (valid) {
				const { addToCaddyRoute } = await import(
					"../../utils/domain-verifier",
				);
				await addToCaddyRoute(
					domain.domain,
					domain.projectId,
					project?.name ?? "",
				);
			}
			return {
				domain: domain.domain,
				validationStatus,
				serverIp: ip,
			};
		},
	)
	.delete(
		"/domains/:id",
		async ({ params: { id }, set }) => {
			const domain = await getDomainById(id);
			if (!domain) {
				set.status = 404;
				return { error: "Domain not found" };
			}
			const { removeFromCaddyRoute } = await import(
				"../../utils/domain-verifier",
			);
			const project = await getProjectById(domain.projectId);
			await deleteDomain(id);
			if (project)
				removeFromCaddyRoute(
					domain.domain,
					project.id,
					project.name,
				);
			return { ok: true };
		},
	);
