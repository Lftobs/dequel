import { describe, expect, test } from "bun:test";
import { summarizeDeploymentError } from "../deployment-errors";

describe("summarizeDeploymentError", () => {
	test("extracts an actionable runtime requirement from noisy build output", () => {
		const error = new Error(`railpack build failed:
DEBU Building /app/workspace/deployment-id
0.917 > next build
1.049 You are using Node.js 18.20.8. For Next.js, Node.js version ">=20.9.0" is required.
ERRO failed to solve: process "sh -c pnpm run build" did not complete successfully: exit code: 1
unrecognized image format`);

		expect(summarizeDeploymentError(error)).toBe(
			'You are using Node.js 18.20.8. For Next.js, Node.js version ">=20.9.0" is required.',
		);
	});

	test("extracts compiler and package errors regardless of deployment stack", () => {
		expect(
			summarizeDeploymentError(
				new Error("docker compose build failed: step 8\nError: Module @repo/ui not found\nstack trace line"),
			),
		).toBe("Error: Module @repo/ui not found");
	});

	test("keeps an already concise error", () => {
		expect(summarizeDeploymentError(new Error("Container exited with code 1"))).toBe("Container exited with code 1");
	});

	test("uses a generic message when output has no useful error", () => {
		expect(summarizeDeploymentError(new Error("DEBU build stopped\nDONE"))).toBe(
			"Deployment failed. Check the deployment logs for details.",
		);
	});
});
