export interface RemoteComposeScriptInput {
  deploymentId: string;
  workspaceRoot: string;
  gitUrl: string;
  branch?: string | null;
  commitSha?: string | null;
  projectName: string;
  dockerNetwork: string;
  environmentVariables: { key: string; value: string }[];
  sourceDir?: string | null;
}

const sh = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export const buildRemoteComposeScript = (input: RemoteComposeScriptInput): string => {
  const checkoutSha = input.commitSha
    ? `git fetch --depth 1 origin ${sh(input.commitSha)} && git checkout ${sh(input.commitSha)}`
    : input.branch
      ? `git checkout ${sh(input.branch)}`
      : "true";

  const remoteWorkspace = input.workspaceRoot.startsWith("/app")
    ? "$HOME/.dequel/workspace"
    : input.workspaceRoot;

  const envLines = input.environmentVariables
    .map((v) => `${v.key}=${v.value}`)
    .join("\n");

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
    'if ! command -v docker >/dev/null 2>&1; then',
    '  echo "[compose] ERROR: docker is not installed"',
    "  exit 1",
    "fi",
    'if ! docker compose version >/dev/null 2>&1; then',
    '  echo "[compose] ERROR: docker compose plugin is not installed"',
    "  exit 1",
    "fi",
    "",
    `echo "[compose] Cloning repository ${input.gitUrl}"`,
    `git clone --depth 1 ${sh(input.gitUrl)} .`,
    checkoutSha,
    "",
    sourceDirLine,
    "",
    ...(envLines
      ? [
          'cat > .env << \'ENVEOF\'',
          envLines,
          "ENVEOF",
          "",
        ]
      : []),
    'COMPOSE_FILE=""',
    'for f in docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do',
    '  if [ -f "$f" ]; then COMPOSE_FILE="$f"; break; fi',
    "done",
    'if [ -z "$COMPOSE_FILE" ]; then echo "[compose] ERROR: no compose file found"; exit 1; fi',
    "",
    `echo "[compose] Building and starting stack (project: deploy-${input.deploymentId})"`,
    `docker compose -f "$COMPOSE_FILE" -p deploy-${input.deploymentId} build`,
    `docker compose -f "$COMPOSE_FILE" -p deploy-${input.deploymentId} up -d`,
    "",
    'echo "[compose] Connecting containers to network ' + input.dockerNetwork + '"',
    `for cid in $(docker compose -p deploy-${input.deploymentId} ps -q); do`,
    `  docker network connect ${input.dockerNetwork} "$cid" || true`,
    "done",
    "",
    'echo "[compose] Collecting container names"',
    `docker compose -p deploy-${input.deploymentId} ps --format '{{.Service}}|{{.Name}}|{{.Ports}}'`,
    "",
    `echo "DONE:deploy-${input.deploymentId}"`,
  ].filter((line) => line !== undefined).join("\n");
};

export interface RemoteComposeResult {
  projectName: string;
  containers: Record<string, string>;
  ports: Record<string, number>;
}

export const parseRemoteComposeResult = (stdout: string): RemoteComposeResult | null => {
  const doneLine = stdout.split("\n").reverse().find((l) => l.startsWith("DONE:"));
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
