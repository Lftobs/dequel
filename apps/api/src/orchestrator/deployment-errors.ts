const ansiPattern = /\u001b\[[0-9;]*m/g;
const noisyLinePattern = /^(DEBU|DEBUG|DONE|CACHED|loading|resolving?|copy |transferring context|sha256:|[-─╭╰│▸↳⚠])/i;
const wrapperPattern = /^(railpack build failed|docker compose (build|up) failed|failed to solve|error: process .* did not complete successfully|unrecognized image format)/i;
const actionablePattern = /(error:|exception:|failed:|not found|cannot find|could not|requires?|required|unsupported|permission denied|out of memory|no space left|timed out|timeout|exited with code|address already in use|connection refused|ELIFECYCLE)/i;

export const summarizeDeploymentError = (error: unknown): string => {
	const raw = error instanceof Error ? error.message : String(error ?? "");
	const lines = raw
		.replace(ansiPattern, "")
		.split("\n")
		.map((line) => line.trim().replace(/^#\d+\s+(?:\d+\.\d+\s+)?/, "").replace(/^\d+\.\d+\s+/, ""))
		.filter(Boolean);

	const actionable = lines.find(
		(line) => actionablePattern.test(line) && !wrapperPattern.test(line) && !noisyLinePattern.test(line),
	);
	if (actionable) return actionable.slice(0, 500);

	if (lines.length === 1 && !noisyLinePattern.test(lines[0])) {
		return lines[0].slice(0, 500);
	}

	return "Deployment failed. Check the deployment logs for details.";
};
