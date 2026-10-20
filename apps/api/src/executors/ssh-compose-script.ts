import { gitAuthScriptLines, redactGitUrl } from "../orchestrator/source";

export interface RemoteComposeScriptInput {
	deploymentId: string;
	workspaceRoot: string;
	gitUrl: string;
	branch?: string | null;
	commitSha?: string | null;
	projectName: string;
	dockerNetwork: string;
	environmentVariables: { key: string; value: string; scope?: string }[];
	sourceDir?: string | null;
}

export interface RemoteComposeVarRef {
	key: string;
	mode: "plain" | "default" | "defaultUnset" | "required" | "requiredSet";
	defaultValue: string | null;
}

export const parseRemoteComposeVarsMarker = (stdout: string): RemoteComposeVarRef[] => {
	const line = stdout.split("\n").find((l) => l.startsWith("DEQUEL_COMPOSE_VARS:"));
	if (!line) return [];
	try {
		const parsed = JSON.parse(line.slice("DEQUEL_COMPOSE_VARS:".length).trim());
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const sh = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export const buildRemoteComposeScript = (input: RemoteComposeScriptInput): string => {
	const checkoutSha = input.commitSha
		? `git fetch --depth 1 origin ${sh(input.commitSha)} && git checkout ${sh(input.commitSha)}`
		: input.branch
			? `git checkout ${sh(input.branch)}`
			: "true";

	const remoteWorkspace = input.workspaceRoot.startsWith("/app") ? "$HOME/.dequel/workspace" : input.workspaceRoot;

	const envLines = input.environmentVariables.map((v) => `${v.key}=${v.value}`).join("\n");
	const envRecord = JSON.stringify(Object.fromEntries(input.environmentVariables.map((v) => [v.key, v.value])));
	const scopeRecord = JSON.stringify(
		Object.fromEntries(input.environmentVariables.map((v) => [v.key, v.scope ?? "both"])),
	);

	const sourceDirLine = input.sourceDir ? `cd ${sh(input.sourceDir)}` : "";

	return [
		"set -euo pipefail",
		"",
		`WORKSPACE="${remoteWorkspace}"`,
		`DEPLOY_DIR="$WORKSPACE/${input.deploymentId}"`,
		'echo "[compose] Preparing workspace"',
		'rm -rf "$DEPLOY_DIR"',
		'mkdir -p "$DEPLOY_DIR"',
		'cd "$DEPLOY_DIR"',
		"",
		"if ! command -v docker >/dev/null 2>&1; then",
		'  echo "[compose] ERROR: docker is not installed"',
		"  exit 1",
		"fi",
		"if ! docker compose version >/dev/null 2>&1; then",
		'  echo "[compose] ERROR: docker compose plugin is not installed"',
		"  exit 1",
		"fi",
		"",
		`echo "[compose] Cloning repository " ${sh(redactGitUrl(input.gitUrl))}`,
		...gitAuthScriptLines(input.gitUrl),
		`git clone --depth 1 ${sh(redactGitUrl(input.gitUrl))} .`,
		checkoutSha,
		"",
		sourceDirLine,
		"",
		...(envLines ? ["cat > .env << 'ENVEOF'", envLines, "ENVEOF", ""] : []),
		'COMPOSE_FILE=""',
		"for f in docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do",
		'  if [ -f "$f" ]; then COMPOSE_FILE="$f"; break; fi',
		"done",
		'if [ -z "$COMPOSE_FILE" ]; then echo "[compose] ERROR: no compose file found"; exit 1; fi',
		"",
		`export DEQUEL_EXTRA_ENV=${sh(envRecord)}`,
		`export DEQUEL_ENV_SCOPES=${sh(scopeRecord)}`,
		"",
		"if command -v python3 >/dev/null 2>&1; then",
		"DEQUEL_COMPOSE_FILE=\"$COMPOSE_FILE\" python3 - <<'DEQUEL_PREFLIGHT_EOF'",
		"import json, os, re, subprocess, sys",
		"",
		'compose_file = os.environ["DEQUEL_COMPOSE_FILE"]',
		'envs = json.loads(os.environ["DEQUEL_EXTRA_ENV"])',
		"try:",
		'    scopes = json.loads(os.environ.get("DEQUEL_ENV_SCOPES") or "{}")',
		"except Exception:",
		"    scopes = {}",
		"",
		'SEVERITY = {"plain": 0, "defaultUnset": 1, "default": 1, "requiredSet": 2, "required": 2}',
		"refs = {}",
		"",
		"def add_ref(key, mode, default=None):",
		"    current = refs.get(key)",
		'    if current is None or SEVERITY[mode] > SEVERITY[current["mode"]]:',
		'        refs[key] = {"key": key, "mode": mode, "defaultValue": default}',
		'    elif SEVERITY[mode] == SEVERITY[current["mode"]] and not current["defaultValue"] and default:',
		'        current["defaultValue"] = default',
		"",
		"text = open(compose_file).read()",
		'new_text = re.sub(r"\\{\\{environment\\.([A-Za-z_][A-Za-z0-9_]*)\\}\\}", lambda m: "${%s}" % m.group(1), text)',
		"if new_text != text:",
		'    open(compose_file, "w").write(new_text)',
		'    print("[compose] Rewrote {{environment.*}} templates in the compose file to ${VAR} syntax")',
		"text = new_text",
		"",
		'for m in re.finditer(r"(?<!\\$)\\$\\{([A-Za-z_][A-Za-z0-9_]*)(:-|-|:\\?|\\?)([^}]*)\\}", text):',
		"    key, op, rest = m.group(1), m.group(2), m.group(3)",
		'    if op == ":-":',
		'        add_ref(key, "default", rest)',
		'    elif op == "-":',
		'        add_ref(key, "defaultUnset", rest)',
		'    elif op == ":?":',
		'        add_ref(key, "required")',
		"    else:",
		'        add_ref(key, "requiredSet")',
		'for m in re.finditer(r"(?<!\\$)\\$\\{([A-Za-z_][A-Za-z0-9_]*)\\}", text):',
		'    add_ref(m.group(1), "plain")',
		"",
		"if refs:",
		'    print("DEQUEL_COMPOSE_VARS: " + json.dumps(list(refs.values())))',
		"",
		"missing = []",
		"for ref in refs.values():",
		'    value = envs.get(ref["key"])',
		'    if ref["mode"] == "required" and (value is None or value == ""):',
		'        missing.append(ref["key"])',
		'    elif ref["mode"] == "requiredSet" and ref["key"] not in envs:',
		'        missing.append(ref["key"])',
		"if missing:",
		'    print("[compose] ERROR: missing required environment variables: " + ", ".join(missing))',
		'    print("[compose] They are declared with ${VAR:?} in the compose file. Set their values in the project environment tab, then redeploy.")',
		"    sys.exit(1)",
		"",
		"try:",
		"    config = json.loads(",
		"        subprocess.check_output(",
		'            ["docker", "compose", "-f", compose_file, "config", "--format", "json"],',
		"            stderr=subprocess.DEVNULL,",
		"        ).decode()",
		"    )",
		'    services = list((config.get("services") or {}).keys())',
		'    build_services = [s for s, c in (config.get("services") or {}).items() if isinstance(c, dict) and c.get("build")]',
		"except Exception as error:",
		'    print("[compose] WARNING: could not enumerate compose services (%s); skipping platform env injection" % error)',
		"    services = []",
		"    build_services = []",
		"",
		'runtime = [(k, v) for k, v in envs.items() if scopes.get(k, "both") != "build"]',
		'build = [(k, v) for k, v in envs.items() if scopes.get(k, "both") != "runtime"]',
		"",
		"if services and (runtime or build):",
		"    build_set = set(build_services)",
		'    lines = ["services:"]',
		"    for svc in services:",
		"        is_build = svc in build_set",
		"        if not is_build and not runtime:",
		"            continue",
		'        lines.append("  %s:" % svc)',
		"        if runtime:",
		'            lines.append("    environment:")',
		"            for k, v in runtime:",
		'                lines.append("      %s: %s" % (k, json.dumps(v.replace("$", "$$"))))',
		"        if is_build and build:",
		'            lines.append("    build:")',
		'            lines.append("      args:")',
		"            for k, v in build:",
		'                lines.append("        %s: %s" % (k, json.dumps(v.replace("$", "$$"))))',
		'    open("dequel-env-override.yml", "w").write("\\n".join(lines) + "\\n")',
		'    print("[compose] Injected %d runtime env var(s) and %d build arg(s) into %d service(s)" % (len(runtime), len(build), len(services)))',
		"DEQUEL_PREFLIGHT_EOF",
		"else:",
		'  echo "[compose] WARNING: python3 not found; skipping compose variable pre-flight"',
		"fi",
		"",
		'OVERRIDE_ARGS=""',
		'if [ -f dequel-env-override.yml ]; then OVERRIDE_ARGS="-f dequel-env-override.yml"; fi',
		`echo "[compose] Building and starting stack (project: deploy-${input.deploymentId})"`,
		`docker compose -f "$COMPOSE_FILE" $OVERRIDE_ARGS -p deploy-${input.deploymentId} build`,
		`docker compose -f "$COMPOSE_FILE" $OVERRIDE_ARGS -p deploy-${input.deploymentId} up -d`,
		"",
		`echo "[compose] Connecting containers to network ${input.dockerNetwork}"`,
		`for cid in $(docker compose -p deploy-${input.deploymentId} ps -q); do`,
		`  docker network connect ${input.dockerNetwork} "$cid" || true`,
		"done",
		"",
		'echo "[compose] Collecting container names"',
		`docker compose -p deploy-${input.deploymentId} ps --format '{{.Service}}|{{.Name}}|{{.Ports}}'`,
		"",
		`echo "DONE:deploy-${input.deploymentId}"`,
	]
		.filter((line) => line !== undefined)
		.join("\n");
};

export interface RemoteComposeResult {
	projectName: string;
	containers: Record<string, string>;
	ports: Record<string, number>;
}

export const parseRemoteComposeResult = (stdout: string): RemoteComposeResult | null => {
	const doneLine = stdout
		.split("\n")
		.reverse()
		.find((l) => l.startsWith("DONE:"));
	if (!doneLine) return null;

	const projectName = doneLine.slice("DONE:".length).trim();

	const containers: Record<string, string> = {};
	const ports: Record<string, number> = {};
	for (const line of stdout.split("\n")) {
		const parts = line.split("|");
		if (parts.length >= 2 && parts[0] && parts[1]) {
			const svcName = parts[0].trim();
			containers[svcName] = parts[1].trim();
			if (parts[2]) {
				const portMatch = parts[2].trim().match(/:(\d+)->(\d+)/);
				if (portMatch) {
					ports[svcName] = Number(portMatch[2]);
				}
			}
		}
	}

	return { projectName, containers, ports };
};

export const buildRemoteComposeDestroyScript = (projectName: string): string => {
	return [
		"set -euo pipefail",
		`echo "[compose] Destroying stack ${projectName}"`,
		`docker compose -p ${sh(projectName)} down -v --remove-orphans`,
		`echo "[compose] Stack ${projectName} destroyed"`,
	].join("\n");
};
