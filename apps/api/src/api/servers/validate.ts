import { isPort, SERVER_HOST_RE } from "../../utils/validate";

export const validateServerCreate = (body: any): string | null => {
	if (!body?.name || !body?.host) return "name and host are required";
	if (typeof body.host !== "string" || !SERVER_HOST_RE.test(body.host)) {
		return "host must be a valid hostname or IP address";
	}
	const mode = body.mode ?? "ssh";
	if (mode !== "ssh" && mode !== "agent") return "mode must be 'ssh' or 'agent'";
	if (body.port !== undefined && body.port !== null && !isPort(Number(body.port))) {
		return "port must be between 1 and 65535";
	}
	if (body.sshKey) {
		return "SSH keys cannot be attached to a server directly. Add the key to the SSH key pool, then pass its sshKeyId.";
	}
	if (body.sshKeyId && typeof body.sshKeyId !== "string") return "sshKeyId must be a string";
	if (mode === "ssh" && !body.sshKeyId && !body.sshPassword) {
		return "SSH servers need a pool key (sshKeyId) or a password (sshPassword)";
	}
	return null;
};
