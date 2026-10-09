import { createAgentRegistrationToken, getServerById, updateServerStatus } from "../db/repo";
import type { Server } from "../types";
import { config } from "../utils/config";
import { runRemoteScript } from "../utils/ssh";

export type PrepareEmit = (stage: string, message: string, done?: boolean, ok?: boolean, error?: string) => void;

const PREPARE_SCRIPT = String.raw`
set -euo pipefail
log() { echo "[prepare:$1] $2"; }

if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

OS="$(grep -oP '^ID=\K.*' /etc/os-release 2>/dev/null || echo unknown)"
log "connect" "Connected as $(whoami)@$(hostname) ($OS)"

install_docker() {
  case "$OS" in
    debian|ubuntu)
      curl -fsSL https://get.docker.com | $SUDO sh
      ;;
    alpine)
      $SUDO apk add --no-cache docker openrc
      $SUDO rc-update add docker default || true
      $SUDO rc-service docker start || true
      ;;
    fedora|rhel|centos|rocky|almalinux|ol|amzn)
      $SUDO dnf install -y docker || $SUDO yum install -y docker || true
      ;;
  esac
}

if command -v docker >/dev/null 2>&1; then
  log "docker" "Docker already installed ($(docker --version 2>/dev/null || echo present))"
else
  log "docker" "Installing Docker..."
  install_docker
fi
if ! command -v docker >/dev/null 2>&1; then
  log "docker" "Docker install failed - install Docker manually (https://docs.docker.com/engine/install/)"
  exit 1
fi
$SUDO systemctl start docker 2>/dev/null || $SUDO service docker start 2>/dev/null || $SUDO rc-service docker start 2>/dev/null || true
if [ -n "$SUDO" ]; then
  $SUDO usermod -aG docker "$(whoami)" 2>/dev/null || true
fi
log "docker" "Docker ready"

find_container() {
  docker ps -a --format '{{.Names}}' 2>/dev/null | grep -m1 "$1" || true
}

find_running_container() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -m1 "$1" || true
}

remove_stopped() {
  local label="$1" name="$2"
  local all running
  all="$(docker ps -a --format '{{.Names}}' 2>/dev/null || true)"
  running="$(docker ps --format '{{.Names}}' 2>/dev/null || true)"
  if grep -qxF "$name" <<< "$all" && ! grep -qxF "$name" <<< "$running"; then
    if $SUDO docker rm -f "$name" >/dev/null 2>&1; then
      log "$label" "Removed stopped container $name"
    fi
  fi
}

equivalent_caddy() {
  local name image ports mounts
  while IFS='|' read -r name image ports; do
    if [ -z "$name" ]; then
      continue
    fi
    case "$name" in
      *dequel-caddy*)
        echo "$name"
        return 0
        ;;
    esac
    case "$image" in
      *caddy*) ;;
      *) continue ;;
    esac
    case "$ports" in
      *":80->"*|*":443->"*) ;;
      *) continue ;;
    esac
    mounts="$(docker inspect -f '{{range .Mounts}}{{.Destination}} {{end}}' "$name" 2>/dev/null || true)"
    case "$mounts" in
      */etc/caddy/routes*)
        echo "$name"
        return 0
        ;;
    esac
  done <<< "$(docker ps --format '{{.Names}}|{{.Image}}|{{.Ports}}' 2>/dev/null || true)"
  return 0
}

equivalent_buildkit() {
  local name image
  while IFS='|' read -r name image; do
    if [ -z "$name" ]; then
      continue
    fi
    case "$name $image" in
      *buildkit*)
        echo "$name"
        return 0
        ;;
    esac
  done <<< "$(docker ps --format '{{.Names}}|{{.Image}}' 2>/dev/null || true)"
  return 0
}

equivalent_running() {
  case "$1" in
    caddy)
      equivalent_caddy
      ;;
    buildkit)
      equivalent_buildkit
      ;;
  esac
  return 0
}

ensure_container() {
  local label="$1" name="$2"
  shift 2
  local running existing equivalent err
  running="$(find_running_container "$name")"
  if [ -n "$running" ]; then
    log "$label" "Container already running as $running"
    remove_stopped "$label" "$name"
    return 0
  fi
  existing="$(find_container "$name")"
  if [ -n "$existing" ]; then
    log "$label" "Starting existing container $existing..."
    if $SUDO docker start "$existing" >/dev/null 2>&1; then
      log "$label" "Started $existing"
      return 0
    fi
    remove_stopped "$label" "$name"
    log "$label" "Existing container $existing did not start"
  fi
  log "$label" "Starting Dequel $label container..."
  err=""
  if err="$($SUDO docker run "$@" 2>&1 >/dev/null)"; then
    log "$label" "Started $label container"
    return 0
  fi
  equivalent="$(equivalent_running "$label")"
  if [ -n "$equivalent" ]; then
    log "$label" "Launch failed but equivalent container $equivalent is already running - reusing it"
    remove_stopped "$label" "$name"
    return 0
  fi
  remove_stopped "$label" "$name"
  if [ -z "$err" ]; then
    err="unknown docker error"
  fi
  echo "[prepare:$label] Failed to start $label container: $err" >&2
  exit 1
}

install_caddy() {
  $SUDO mkdir -p /etc/caddy/routes
  if [ ! -f /etc/caddy/Caddyfile ]; then
    printf 'import /etc/caddy/routes/*.caddy\n' | $SUDO tee /etc/caddy/Caddyfile > /dev/null
  elif ! grep -q "routes/\*.caddy" /etc/caddy/Caddyfile 2>/dev/null; then
    printf 'import /etc/caddy/routes/*.caddy\n' | cat - /etc/caddy/Caddyfile > /tmp/dequel-caddyfile
    $SUDO mv /tmp/dequel-caddyfile /etc/caddy/Caddyfile
  fi

  $SUDO docker network create dequel_net 2>/dev/null || true
  ensure_container caddy dequel-caddy -d --restart unless-stopped --name dequel-caddy --network dequel_net -p 80:80 -p 443:443 -v /etc/caddy/Caddyfile:/etc/caddy/Caddyfile -v /etc/caddy/routes:/etc/caddy/routes -v caddy_data:/data caddy:alpine
}

install_caddy
log "caddy" "Caddy ready"

if command -v railpack >/dev/null 2>&1 || command -v n >/dev/null 2>&1; then
  log "railpack" "Railpack already installed"
else
  log "railpack" "Installing Railpack..."
  curl -fsSL https://railpack.com/install.sh | $SUDO sh -s -- --bin-dir /usr/local/bin
fi
if command -v railpack >/dev/null 2>&1 || command -v n >/dev/null 2>&1; then
  log "railpack" "Railpack ready"
else
  log "railpack" "Railpack install failed - builds will attempt auto-install"
fi

ensure_container buildkit buildkit -d --restart unless-stopped --name buildkit --privileged moby/buildkit:latest

log "done" "Server preparation complete"
`;

export const parseLine = (line: string, emit: PrepareEmit) => {
	const match = line.match(/^\[prepare:([a-z]+)\]\s?(.*)$/);
	if (match) {
		emit(match[1], match[2]);
	} else if (line.trim()) {
		emit("output", line);
	}
};

export const prepareSshServer = async (server: Server, emit: PrepareEmit): Promise<void> => {
	try {
		const result = await runRemoteScript(server, PREPARE_SCRIPT, {
			onLog: (line) => parseLine(line, emit),
		});
		if (result.code !== 0) {
			const last = result.stderr.trim().split("\n").pop() || result.stdout.trim().split("\n").pop() || "Unknown error";
			emit("error", last, true, false, last);
			await updateServerStatus(server.id, "failed");
			return;
		}
		await updateServerStatus(server.id, "connected");
		emit("done", "Server is ready to deploy to", true, true);
	} catch (err) {
		const message = err instanceof Error ? err.message : "SSH connection failed";
		emit("error", message, true, false, message);
		await updateServerStatus(server.id, "failed").catch(() => {});
	}
};

const AGENT_RUN_COMMAND = (token: string) => {
	const parts = [
		"docker run -d --name dequel-agent --cap-add=NET_ADMIN --device /dev/net/tun --restart unless-stopped",
	];
	if (config.controlPlaneUrl) {
		parts.push(`-e DEQUEL_CONTROL_PLANE="${config.controlPlaneUrl}"`);
	}
	if (config.agentTunnelUrl) {
		parts.push(`-e DEQUEL_AGENT_TUNNEL_URL="${config.agentTunnelUrl}"`);
	}
	parts.push(
		`-e DEQUEL_REGISTRATION_TOKEN="${token}"`,
		`-v dequel-agent-data:/root/.dequel -v /var/run/docker.sock:/var/run/docker.sock`,
		`ghcr.io/lftobs/dequel/agent:latest`,
	);
	return parts.join(" ");
};

export const prepareAgentServer = async (server: Server, emit: PrepareEmit): Promise<void> => {
	try {
		emit("register", "Creating agent registration token...");
		const token = await createAgentRegistrationToken(server.name, server.labels || {});
		emit("token", AGENT_RUN_COMMAND(token.token));
		emit("register", "Waiting for agent to register (runs the command above on the server)...");
		const deadline = Date.now() + 180_000;
		let connected = false;
		while (Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, 5_000));
			const current = await getServerById(server.id).catch(() => null);
			if (current?.status === "connected" && current.agentId) {
				connected = true;
				break;
			}
			if (Date.now() < deadline) {
				emit("register", "Still waiting for agent...");
			}
		}
		if (connected) {
			emit("done", "Agent registered successfully", true, true);
		} else {
			const message = "Timed out waiting for the agent to register (180s)";
			await updateServerStatus(server.id, "failed").catch(() => {});
			emit("error", message, true, false, message);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to prepare agent server";
		await updateServerStatus(server.id, "failed").catch(() => {});
		emit("error", message, true, false, message);
	}
};

const inFlight = new Set<string>();

export const prepareServer = (server: Server, emit: PrepareEmit): void => {
	if (inFlight.has(server.id)) {
		emit("error", "Server preparation is already running", true, false, "Already running");
		return;
	}
	inFlight.add(server.id);
	const wrappedEmit: PrepareEmit = (stage, message, done = false, ok = false, error) => {
		if (done) inFlight.delete(server.id);
		emit(stage, message, done, ok, error);
	};
	if (server.mode === "agent") {
		void prepareAgentServer(server, wrappedEmit);
	} else if (server.mode === "ssh") {
		void prepareSshServer(server, wrappedEmit);
	} else {
		wrappedEmit("error", "Only ssh and agent servers can be prepared", true, false, "Unsupported mode");
	}
};

export const isServerPreparing = (serverId: string): boolean => inFlight.has(serverId);
