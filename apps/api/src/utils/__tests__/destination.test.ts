import { describe, expect, it, mock } from "bun:test";
import { validateDestination } from "../destination";

mock.restore();

describe("validateDestination", () => {
	it("rejects non-http protocols and credentials", async () => {
		expect(await validateDestination("ftp://example.com/x")).toMatch(/http or https/);
		expect(await validateDestination("https://user:pass@example.com/")).toMatch(/credentials/);
		expect(await validateDestination("not-a-url")).toMatch(/valid URL/);
	});

	it("rejects literal private IPs without DNS", async () => {
		expect(await validateDestination("http://10.0.0.5/hook")).toMatch(/public address/);
		expect(await validateDestination("http://192.168.1.10/hook")).toMatch(/public address/);
		expect(await validateDestination("http://127.0.0.1:9/hook")).toMatch(/public address/);
		expect(await validateDestination("http://[::1]/hook")).toMatch(/public address/);
	});

	it("does not reject domain names before DNS resolution", async () => {
		const res = await validateDestination("https://webhook.site/db-test-123");
		expect(res === null || res === "destination hostname could not be resolved").toBe(true);
	});
});
