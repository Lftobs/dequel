export interface SshBuildScriptInput {
	deploymentId: string;
	workspaceRoot: string;
	gitUrl: string;
	branch?: string | null;
	commitSha?: string | null;
	imageTag: string;
	clearCache?: boolean;
	environmentVariables: { key: string; value: string }[];
	sourceDir?: string | null;
	projectType?: string | null;
	buildCommand?: string | null;
	installCommand?: string | null;
	outputDir?: string | null;
	startCommand?: string | null;
	railpackGenerator: string;
}

const sh = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

const GENERATOR_EOF = "DEQUEL_RAILPACK_GEN_EOF";

const GENERATOR_CLI = `const [workspace, sourceDir, projectType, buildCommand, startCommand, installCommand, outputDir] =
	process.argv.slice(2);
await generateDynamicRailpackJson(
	workspace,
	sourceDir || null,
	projectType || null,
	buildCommand || null,
	startCommand || null,
	async (line) => console.log(line),
	installCommand || null,
	outputDir || null,
);`;

export const buildRemoteDeployScript = (input: SshBuildScriptInput): string => {
	const cacheKey = input.imageTag
		.split(":")[0]
		.replace(/-[0-9a-f]{8}$/i, "")
		.replace(/[^a-zA-Z0-9_-]/g, "-");
	const effectiveCacheKey = input.clearCache ? `${cacheKey}-clear-${Date.now()}` : cacheKey;

	const envFlags = input.environmentVariables.map((env) => `--env ${sh(`${env.key}=${env.value}`)}`).join(" ");

	const checkoutSha = input.commitSha
		? `git fetch --depth 1 origin ${sh(input.commitSha)} && git checkout ${sh(input.commitSha)}`
		: input.branch
			? `git checkout ${sh(input.branch)}`
			: "true";

	const remoteWorkspace = input.workspaceRoot.startsWith("/app") ? "$HOME/.dequel/workspace" : input.workspaceRoot;

	const generatorArgs = [
		'"$PROJECT_DIR"',
		sh(input.sourceDir ?? ""),
		sh(input.projectType ?? ""),
		sh(input.buildCommand ?? ""),
		sh(input.startCommand ?? ""),
		sh(input.installCommand ?? ""),
		sh(input.outputDir ?? ""),
	].join(" ");

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
		"if command -v railpack >/dev/null 2>&1; then",
		'  echo "[build] Railpack already installed"',
		"else",
		'  echo "[build] Installing railpack"',
		"  curl -fsSL https://railpack.com/install.sh | sh -s -- --bin-dir /usr/local/bin",
		"fi",
		"",
		'if ! docker ps --format "{{.Names}}" | grep -q "^buildkit$"; then',
		'  echo "[build] Starting BuildKit container"',
		"  docker run -d --restart unless-stopped --name buildkit --privileged moby/buildkit:latest || true",
		"fi",
		'export BUILDKIT_HOST="docker-container://buildkit"',
		"",
		`echo "[build] Cloning repository ${input.gitUrl}"`,
		`git clone --depth 1 ${sh(input.gitUrl)} .`,
		checkoutSha,
		"",
		'if command -v bun >/dev/null 2>&1 || [ -x "$HOME/.bun/bin/bun" ]; then',
		'  echo "[build] bun already installed"',
		"else",
		'  echo "[build] Installing bun (required to generate railpack.json)"',
		'  ARCH="$(uname -m)"',
		'  case "$ARCH" in',
		"    x86_64) BUN_ARCH=x64 ;;",
		"    aarch64|arm64) BUN_ARCH=aarch64 ;;",
		'    *) echo "[build] unsupported architecture for bun: $ARCH" >&2; exit 1 ;;',
		"  esac",
		"  if command -v python3 >/dev/null 2>&1; then",
		'    mkdir -p "$HOME/.bun/bin" /tmp/dequel-bun',
		'    curl -fsSL -o /tmp/dequel-bun.zip "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-${BUN_ARCH}.zip"',
		"    python3 -m zipfile -e /tmp/dequel-bun.zip /tmp/dequel-bun",
		'    mv "/tmp/dequel-bun/bun-linux-${BUN_ARCH}/bun" "$HOME/.bun/bin/bun"',
		'    chmod +x "$HOME/.bun/bin/bun"',
		"    rm -rf /tmp/dequel-bun.zip /tmp/dequel-bun",
		"  elif command -v unzip >/dev/null 2>&1; then",
		'    curl -fsSL https://bun.sh/install | BUN_INSTALL="$HOME/.bun" bash',
		"  else",
		'    echo "[build] bun install requires python3 or unzip on this machine" >&2',
		"    exit 1",
		"  fi",
		"fi",
		'export PATH="$HOME/.bun/bin:$PATH"',
		"if ! command -v bun >/dev/null 2>&1; then",
		'  echo "[build] bun is required to generate railpack.json but is not installed" >&2',
		"  exit 1",
		"fi",
		"",
		'echo "[build] Generating dynamic railpack.json for caching and monorepo resolution"',
		`cat > "$PROJECT_DIR/.dequel-railpack-gen.ts" <<'${GENERATOR_EOF}'`,
		input.railpackGenerator,
		GENERATOR_CLI,
		GENERATOR_EOF,
		`bun "$PROJECT_DIR/.dequel-railpack-gen.ts" ${generatorArgs}`,
		'rm -f "$PROJECT_DIR/.dequel-railpack-gen.ts"',
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
	]
		.filter((line) => line !== "")
		.join("\n");
};

export interface RemoteBuildResult {
	imageTag: string;
	commitSha?: string;
}

export const parseRemoteBuildResult = (stdout: string): RemoteBuildResult | null => {
	const line = stdout
		.split("\n")
		.reverse()
		.find((l) => l.startsWith("RESULT:"));
	if (!line) return null;
	try {
		return JSON.parse(line.slice("RESULT:".length)) as RemoteBuildResult;
	} catch {
		return null;
	}
};
