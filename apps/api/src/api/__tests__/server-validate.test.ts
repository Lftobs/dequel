import { describe, expect, test } from "bun:test";
import { validateServerCreate } from "../servers/validate";

describe("validateServerCreate", () => {
	test("rejects inline ssh keys", () => {
		expect(
			validateServerCreate({
				name: "node-1",
				host: "10.0.0.1",
				sshKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
				sshKeyId: "key-1",
			}),
		).toContain("SSH key pool");
	});

	test("rejects ssh mode without pool key or password", () => {
		expect(validateServerCreate({ name: "node-1", host: "10.0.0.1" })).toContain("sshKeyId");
	});

	test("accepts ssh mode with pool key", () => {
		expect(validateServerCreate({ name: "node-1", host: "10.0.0.1", sshKeyId: "key-1" })).toBeNull();
		expect(validateServerCreate({ name: "node-1", host: "10.0.0.1", sshPassword: "secret" })).toBeNull();
	});

	test("rejects non-string sshPassword values", () => {
		expect(validateServerCreate({ name: "node-1", host: "10.0.0.1", sshPassword: { pw: true } })).toContain(
			"sshPassword",
		);
	});

	test("agent mode needs no ssh credentials", () => {
		expect(validateServerCreate({ name: "homelab", host: "10.0.0.1", mode: "agent" })).toBeNull();
	});

	test("keeps host/mode/port validation", () => {
		expect(validateServerCreate({ name: "node-1", host: "bad_host", sshKeyId: "k" })).toContain("host");
		expect(validateServerCreate({ name: "node-1", host: "10.0.0.1", mode: "docker", sshKeyId: "k" })).toContain("mode");
		expect(validateServerCreate({ name: "node-1", host: "10.0.0.1", port: 99999, sshKeyId: "k" })).toContain("port");
		expect(validateServerCreate({ name: "", host: "10.0.0.1", sshKeyId: "k" })).toContain("name and host");
	});
});
