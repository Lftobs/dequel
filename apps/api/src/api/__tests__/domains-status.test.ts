import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockResolve4 = mock();

mock.module("node:dns", () => ({
	promises: {
		resolve4: mockResolve4,
	},
}));

const originalFetch = globalThis.fetch;
beforeEach(() => {
	mockResolve4.mockReset();
	globalThis.fetch = originalFetch;
});

const mockListDomains = mock();
const mockGetProjectById = mock();
const mockCreateDomain = mock();
const mockDeleteDomain = mock();
const mockGetDomainById = mock();
const mockUpdateDomainValidation = mock();

mock.module("../../db/repo", () => ({
	listDomains: mockListDomains,
	getProjectById: mockGetProjectById,
	createDomain: mockCreateDomain,
	deleteDomain: mockDeleteDomain,
	getDomainById: mockGetDomainById,
	updateDomainValidation: mockUpdateDomainValidation,
}));

const { domainsRoutes } = await import("../domains/index");

const app = domainsRoutes;

const fetchJson = async (path: string) => {
	const req = new Request(`http://localhost${path}`);
	const res = await app.handle(req);
	return { status: res.status, body: await res.json() };
};

describe("GET /projects/:id/domains/status", () => {
	it("returns an array for a project with domains", async () => {
		mockGetProjectById.mockResolvedValue({ id: "proj-1", name: "test" });
		mockListDomains.mockResolvedValue([
			{ id: "d1", domain: "example.com", projectId: "proj-1" },
			{ id: "d2", domain: "foo.bar", projectId: "proj-1" },
		]);
		mockResolve4.mockResolvedValue(["1.2.3.4"]);
		globalThis.fetch = mock(() =>
			Promise.resolve({ ok: true, status: 200 }),
		) as typeof fetch;

		const { status, body } = await fetchJson("/projects/proj-1/domains/status");
		expect(status).toBe(200);
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(2);
		expect(body[0]).toHaveProperty("domain", "example.com");
		expect(body[0]).toHaveProperty("dnsOk", true);
		expect(body[0]).toHaveProperty("tlsOk", true);
		expect(body[0]).toHaveProperty("lastChecked");
	});

	it("returns empty array when project has no domains", async () => {
		mockGetProjectById.mockResolvedValue({ id: "proj-1", name: "test" });
		mockListDomains.mockResolvedValue([]);

		const { status, body } = await fetchJson("/projects/proj-1/domains/status");
		expect(status).toBe(200);
		expect(body).toEqual([]);
	});

	it("returns dnsOk false for non-existent domains", async () => {
		mockGetProjectById.mockResolvedValue({ id: "proj-1", name: "test" });
		mockListDomains.mockResolvedValue([
			{ id: "d1", domain: "nonexistent.invalid", projectId: "proj-1" },
		]);
		mockResolve4.mockRejectedValue(new Error("ENOTFOUND"));
		globalThis.fetch = mock(() =>
			Promise.reject(new Error("fetch failed")),
		) as typeof fetch;

		const { status, body } = await fetchJson("/projects/proj-1/domains/status");
		expect(status).toBe(200);
		expect(body).toHaveLength(1);
		expect(body[0].dnsOk).toBe(false);
		expect(body[0].tlsOk).toBe(false);
	});

	it("returns 404 for non-existent project", async () => {
		mockGetProjectById.mockResolvedValue(null);

		const { status } = await fetchJson("/projects/missing/domains/status");
		expect(status).toBe(404);
	});
});
