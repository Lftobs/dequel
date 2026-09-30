import { describe, expect, it } from "bun:test";
import { buildDeploymentFailureEmail, buildEmail, buildSmtpTestEmail } from "../templates";

describe("Email Templates", () => {
	describe("buildDeploymentFailureEmail", () => {
		it("generates a deployment failure email matching Dequel design system", () => {
			const { subject, html } = buildDeploymentFailureEmail({
				projectName: "clinsight-be",
				failureReason: "fix(docker): add build dependencies for pycairo compilation (#29) (#30)",
				commitSha: "a1b2c3d4e5f67890",
				sourceRef: "main",
				finishedAt: "2026-09-24T01:43:00Z",
				logsUrl: "https://dequel.app/project/proj-123?tab=deployments",
			});

			expect(subject).toBe("deploy failed for clinsight-be");
			expect(html).toContain("Dequel");
			expect(html).toContain("DEPLOY FAILED");
			expect(html).toContain("clinsight-be");
			expect(html).toContain("a1b2c3d4e5f6");
			expect(html).toContain("main");
			expect(html).toContain("fix(docker): add build dependencies");
			expect(html).toContain("View Logs");
			expect(html).toContain("https://dequel.app/project/proj-123?tab=deployments");
			expect(html).toContain("Learn more");
			expect(html).toContain("troubleshooting deploys on");
			expect(html).toContain('The <strong style="color:#18181b;">Dequel</strong> team');
			// Check WebP Logo & HTML table Grid graphic presence
			expect(html).toContain("logo_xzvwej.webp");
			expect(html).toContain("border-spacing:3px");
		});

		it("handles missing optional context fields gracefully", () => {
			const { subject, html } = buildDeploymentFailureEmail({
				projectName: "api-service",
				failureReason: null,
				commitSha: null,
				sourceRef: "dev",
				finishedAt: null,
			});

			expect(subject).toBe("deploy failed for api-service");
			expect(html).toContain("DEPLOY FAILED");
			expect(html).not.toContain("View Logs");
		});

		it("escapes HTML in project name, failure reason and source ref", () => {
			const { html } = buildDeploymentFailureEmail({
				projectName: "<img src=x>",
				failureReason: "a < b & c > d",
				commitSha: null,
				sourceRef: "<b>main</b>",
				finishedAt: null,
			});

			expect(html).not.toContain("<img src=x>");
			expect(html).toContain("&lt;img src=x&gt;");
			expect(html).toContain("&lt;b&gt;main&lt;/b&gt;");
			expect(html).toContain("a &lt; b &amp; c &gt; d");
		});
	});

	describe("buildEmail (monitoring alerts)", () => {
		it("generates CPU alert email", () => {
			const { subject, html } = buildEmail("cpu", "web-app", 80, 94.2, {
				containers: [{ name: "web-app-1", value: 94.2 }],
				appUrl: "https://web-app.example.com",
			});

			expect(subject).toBe("High CPU on web-app (94%)");
			expect(html).toContain("CPU ALERT");
			expect(html).toContain("94.2%");
			expect(html).toContain("View Application");
		});

		it("generates Memory alert email", () => {
			const { subject, html } = buildEmail("memory", "worker-app", 85, 91.0);

			expect(subject).toBe("High memory on worker-app (91%)");
			expect(html).toContain("MEMORY ALERT");
			expect(html).toContain("91.0%");
		});

		it("renders the enable-autoscaling suggestion", () => {
			const { html } = buildEmail("cpu", "web-app", 80, 94.2, {
				scaling: { kind: "enable_autoscaling", url: "https://dequel.local/project/p1?tab=scaling" },
			});

			expect(html).toContain("Autoscaling is off");
			expect(html).toContain("Set up autoscaling");
			expect(html).not.toContain("SCALING_HTML");
		});

		it("renders the increase-replicas suggestion", () => {
			const { html } = buildEmail("memory", "web-app", 85, 91.0, {
				scaling: {
					kind: "increase_max_replicas",
					current: 3,
					maxReplicas: 3,
					url: "https://dequel.local/project/p1?tab=scaling",
				},
			});

			expect(html).toContain("Replica limit reached");
			expect(html).toContain("(3/3)");
			expect(html).toContain("Adjust scaling");
		});

		it("renders no scaling box without a suggestion", () => {
			const { html } = buildEmail("cpu", "web-app", 80, 94.2);
			expect(html).not.toContain("SCALING_HTML");
			expect(html).not.toContain("Autoscaling is off");
		});

		it("generates downtime alert email", () => {
			const { subject, html } = buildEmail("downtime", "db-proxy", null, 0, {
				lastRunningAt: "2026-09-26T08:00:00Z",
				logsUrl: "https://dequel.app/logs",
			});

			expect(subject).toBe("db-proxy is down");
			expect(html).toContain("SERVICE DOWN");
			expect(html).toContain("Offline");
			expect(html).toContain("View Logs");
		});

		it("generates cert expiry alert email", () => {
			const { subject, html } = buildEmail("cert_expiry", "my-domain.com", null, 14);

			expect(subject).toBe("SSL certificate for my-domain.com expires in 14 days");
			expect(html).toContain("CERTIFICATE EXPIRY");
			expect(html).toContain("14");
		});

		it("generates default fallback alert email", () => {
			const { subject, html } = buildEmail("disk_space", "storage-node", 90, 95);

			expect(subject).toBe("[Dequel] disk_space alert — storage-node");
			expect(html).toContain("ALERT");
		});

		it("escapes the project name in alert email bodies", () => {
			const { html } = buildEmail("cpu", "a<b> & c", 80, 94.2);

			expect(html).not.toContain("a<b> & c");
			expect(html).toContain("a&lt;b&gt; &amp; c");
		});
	});

	describe("buildSmtpTestEmail", () => {
		it("generates a formatted SMTP test email", () => {
			const { subject, html } = buildSmtpTestEmail();

			expect(subject).toBe("[Dequel] SMTP Test Email");
			expect(html).toContain("SMTP TEST");
			expect(html).toContain("SMTP Transport Verified");
			expect(html).toContain("Dequel");
		});
	});
});
