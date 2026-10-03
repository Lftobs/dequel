export const parseGithubRepo = (
	sourceRef: string,
	branch: string | null,
): { owner: string; repo: string; base: string } | null => {
	const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(sourceRef.trim());
	if (!match) return null;
	return { owner: match[1], repo: match[2], base: branch ?? "main" };
};
