export interface SshBuildScriptInput {
  deploymentId: string;
  workspaceRoot: string;
  gitUrl: string;
  branch?: string | null;
  commitSha?: string | null;
  imageTag: string;
  clearCache?: boolean;
  environmentVariables: { key: string; value: string }[];
}

const sh = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export const buildRemoteDeployScript = (input: SshBuildScriptInput): string => {
  const cacheKey = input.imageTag.split(":")[0].replace(/-[0-9a-f]{8}$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-");
  const effectiveCacheKey = input.clearCache ? `${cacheKey}-clear-${Date.now()}` : cacheKey;

  const envFlags = input.environmentVariables
    .map((env) => `--env ${sh(`${env.key}=${env.value}`)}`)
    .join(" ");

  const checkoutSha = input.commitSha
    ? `git fetch --depth 1 origin ${sh(input.commitSha)} && git checkout ${sh(input.commitSha)}`
    : input.branch
      ? `git checkout ${sh(input.branch)}`
      : "true";

  const remoteWorkspace = input.workspaceRoot.startsWith("/app")
    ? "$HOME/.dequel/workspace"
    : input.workspaceRoot;

  return [
    "set -euo pipefail",
    "",
    `WORKSPACE="${remoteWorkspace}"`,
    `PROJECT_DIR="$WORKSPACE/${input.deploymentId}"`,
    'echo "[build] Ensuring workspace"',
    'rm -rf "$PROJECT_DIR"',
    'mkdir -p "$PROJECT_DIR"',
    'cd "$PROJECT_DIR"',
    "",
    'if command -v railpack >/dev/null 2>&1; then',
    '  echo "[build] Railpack already installed"',
    "else",
    '  echo "[build] Installing railpack"',
    "  curl -fsSL https://railpack.com/install.sh | sh -s -- --bin-dir /usr/local/bin",
    "fi",
    "",
    'if ! docker ps --format "{{.Names}}" | grep -q "^buildkit$"; then',
    '  echo "[build] Starting BuildKit container"',
    '  docker run -d --restart unless-stopped --name buildkit --privileged moby/buildkit:latest || true',
    "fi",
    'export BUILDKIT_HOST="docker-container://buildkit"',
    "",
    `echo "[build] Cloning repository ${input.gitUrl}"`,
    `git clone --depth 1 ${sh(input.gitUrl)} .`,
    checkoutSha,
    "",
    'SHA="$(git rev-parse HEAD)"',
    `echo "[build] Building image ${input.imageTag} with Railpack"`,
    `railpack build --name ${sh(input.imageTag)} --progress plain --cache-key ${sh(effectiveCacheKey)} \\`,
    "  --env CARGO_HTTP_MULTIPLEXING=false --env CARGO_HTTP_TIMEOUT=120 \\",
    "  --env CARGO_NET_GIT_FETCH_WITH_CLI=true --env RUSTUP_AUTO_SELF_UPDATE=off \\",
    "  --env NPM_CONFIG_TIMEOUT=600000 --env NPM_CONFIG_AUDIT=false --env NPM_CONFIG_FUND=false \\",
    "  --env PNPM_CONFIG_TRUST_LOCKFILE=true --env NPM_CONFIG_MAXSOCKETS=4 \\",
    "  --env PNPM_CONFIG_NETWORK_CONCURRENCY=4 --env PNPM_CONFIG_CHILD_CONCURRENCY=4 \\",
    "  --env PNPM_CONFIG_FETCH_RETRIES=10 \\",
    ...(envFlags ? [`  ${envFlags} \\`] : []),
    "  .",
    "",
    `echo "RESULT:{\\"imageTag\\":\\"${input.imageTag}\\",\\"commitSha\\":\\"$SHA\\"}"`,
  ].filter((line) => line !== "").join("\n");
};

export interface RemoteBuildResult {
  imageTag: string;
  commitSha?: string;
}

export const parseRemoteBuildResult = (stdout: string): RemoteBuildResult | null => {
  const line = stdout.split("\n").reverse().find((l) => l.startsWith("RESULT:"));
  if (!line) return null;
  try {
    return JSON.parse(line.slice("RESULT:".length)) as RemoteBuildResult;
  } catch {
    return null;
  }
};