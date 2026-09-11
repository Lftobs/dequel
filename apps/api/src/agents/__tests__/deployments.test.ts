import { describe, expect, it } from "bun:test";
import type { Deployment, Project } from "../../types";
import { validateRemoteDeployment } from "../deployment-contract";

const project = {
	id: "project-1",
	name: "Example",
	serverId: "server-1",
	buildType: "railpack",
	projectType: "web",
	sourceDir: null,
	buildCommand: null,
	installCommand: null,
	outputDir: null,
	startCommand: null,
} as Project;

const deployment = {
	id: "deployment-1",
	projectId: project.id,
	serverId: project.serverId,
	sourceType: "git",
	sourceRef: "https://github.com/example/app.git",
} as Deployment;

describe("remote deployment validation", () => {
	it("accepts public Git Railpack web services", () => {
		expect(validateRemoteDeployment(deployment, project)).toBeNull();
	});

	it("rejects private credential URLs", () => {
		expect(
			validateRemoteDeployment({ ...deployment, sourceRef: "https://token@github.com/example/app.git" }, project),
		).toBe("Remote Git deployments require a public HTTPS repository URL");
	});

	it("rejects unsupported project overrides", () => {
		expect(validateRemoteDeployment(deployment, { ...project, sourceDir: "apps/api" })).toBe(
			"Remote agents do not support source-directory or command overrides yet",
		);
	});

	it("rejects Compose and static projects", () => {
		expect(validateRemoteDeployment(deployment, { ...project, buildType: "compose" })).toBe(
			"Remote agents currently support Railpack web services only",
		);
		expect(validateRemoteDeployment(deployment, { ...project, projectType: "static" })).toBe(
			"Remote agents currently support Railpack web services only",
		);
	});
});
