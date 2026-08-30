import { execRemoteCommand, runRemoteScript } from "../utils/ssh";
import { updateServerStatus, createAgentRegistrationToken, getServerById } from "../db/repo";
import { config } from "../utils/config";
import type { Server } from "../types";

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

install_caddy() {
  $SUDO mkdir -p /etc/caddy/routes
  if [ ! -f /etc/caddy/Caddyfile ]; then
    printf 'import /etc/caddy/routes/*.caddy\n' | $SUDO tee /etc/caddy/Caddyfile > /dev/null
  elif ! grep -q "routes/\*.caddy" /etc/caddy/Caddyfile 2>/dev/null; then
    printf 'import /etc/caddy/routes/*.caddy\n' | cat - /etc/caddy/Caddyfile > /tmp/dequel-caddyfile
    $SUDO mv /tmp/dequel-caddyfile /etc/caddy/Caddyfile
  fi

  $SUDO docker network create dequel_net 2>/dev/null || true
  if ! docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^dequel-caddy$'; then
    log "caddy" "Starting Dequel Caddy container..."
    $SUDO docker run -d --restart unless-stopped --name dequel-caddy --network dequel_net -p 80:80 -p 443:443 -v /etc/caddy/Caddyfile:/etc/caddy/Caddyfile -v /etc/caddy/routes:/etc/caddy/routes -v caddy_data:/data caddy:alpine 2>/dev/null || true
  else
    $SUDO docker start dequel-caddy 2>/dev/null || true
  fi
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

if ! docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^buildkit$'; then
  log "buildkit" "Starting BuildKit container..."
  $SUDO docker run -d --restart unless-stopped --name buildkit --privileged moby/buildkit:latest 2>/dev/null || true
fi

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