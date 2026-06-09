#!/usr/bin/env bash
set -euo pipefail

REPO="Lftobs/dequel"
VERSION="${VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.dequel}"

# Colors
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
AMBER='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

header()  { printf "\n${BOLD}${AMBER}==>${NC}${BOLD} %s${NC}\n" "$*"; }
info()    { printf "  ${DIM}%s${NC}\n" "$*"; }
success() { printf "  ${GREEN}✓${NC} %s\n" "$*"; }
warn()    { printf "  ${AMBER}⚠${NC} %s\n" "$*"; }
fail()    { printf "  ${RED}✗${NC} %s\n" "$*"; exit 1; }

echo ""
echo "${BOLD}  Dequel Installer${NC}"
echo ""

# --- Check Docker ---
header "Checking prerequisites"

if command -v docker &>/dev/null; then
    success "Docker found: $(docker --version)"
else
    fail "Docker is not installed. See https://docs.docker.com/engine/install/"
fi

if docker compose version &>/dev/null; then
    success "Docker Compose found: $(docker compose version)"
elif docker-compose --version &>/dev/null; then
    success "docker-compose found: $(docker-compose --version)"
    warn "Consider upgrading to 'docker compose' (Docker Compose v2)"
    COMPOSE_CMD="docker-compose"
else
    fail "Docker Compose is not installed. See https://docs.docker.com/compose/install/"
fi

COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

header "Setting up installation directory"
mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/workspace" "$INSTALL_DIR/infra/caddy/routes" "$INSTALL_DIR/infra/monitoring/grafana/datasources"

info "Installing to: $INSTALL_DIR"

header "Downloading configuration"

if [ "$VERSION" = "latest" ]; then
    RELEASE_URL="https://api.github.com/repos/$REPO/releases/latest"
    info "Fetching latest release..."
    TAG=$(curl -fsSL "$RELEASE_URL" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -z "$TAG" ]; then
        warn "Could not determine latest release. Falling back to 'main' branch."
        TAG="main"
        BASE_URL="https://raw.githubusercontent.com/$REPO/$TAG"
    else
        BASE_URL="https://raw.githubusercontent.com/$REPO/$TAG"
        success "Latest release: $TAG"
    fi
else
    BASE_URL="https://raw.githubusercontent.com/$REPO/v$VERSION"
fi

download_if_missing() {
    local src="$1" dst="$2"
    if [ -f "$dst" ]; then
        info "  Skipping (exists): $dst"
    else
        curl -fsSL "$src" -o "$dst" || warn "Could not download $src"
        success "Downloaded: $dst"
    fi
}

download_if_missing "$BASE_URL/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"
download_if_missing "$BASE_URL/infra/caddy/Caddyfile" "$INSTALL_DIR/infra/caddy/Caddyfile"

for f in prometheus.yml loki-config.yml promtail-config.yml; do
    download_if_missing "$BASE_URL/infra/monitoring/$f" "$INSTALL_DIR/infra/monitoring/$f"
done

download_if_missing "$BASE_URL/infra/monitoring/grafana/datasources/datasources.yml" "$INSTALL_DIR/infra/monitoring/grafana/datasources/datasources.yml"


header "Configuration"

read -r -p "  Admin email (for SSL notifications, optional): " ADMIN_EMAIL
read -r -p "  Hostname (e.g. dequel.example.com, optional): " HOSTNAME

if [ -n "$ADMIN_EMAIL" ] || [ -n "$HOSTNAME" ]; then
    cat > "$INSTALL_DIR/.env" <<EOF
# Dequel environment configuration
$( [ -n "$ADMIN_EMAIL" ] && echo "CADDY_EMAIL=$ADMIN_EMAIL" )
$( [ -n "$HOSTNAME" ] && echo "CADDY_BASE_DOMAIN=$HOSTNAME" )
EOF
    success "Created $INSTALL_DIR/.env"
fi

header "Pulling Docker images"
$COMPOSE_CMD -f "$INSTALL_DIR/docker-compose.yml" pull || warn "Some images could not be pulled (they will be built on first run)"


# --- Install dequel CLI ---
header "Installing dequel CLI"
CLI_SRC="$INSTALL_DIR/dequel"
if [ -f "$CLI_SRC" ]; then
    info "CLI already downloaded."
else
    download_if_missing "$BASE_URL/scripts/dequel" "$CLI_SRC"
fi
chmod +x "$CLI_SRC"

if [ -w /usr/local/bin ]; then
    ln -sf "$CLI_SRC" /usr/local/bin/dequel
    success "Installed: /usr/local/bin/dequel"
else
    info "Installed at: $CLI_SRC"
    warn "Add to PATH manually: sudo ln -s $CLI_SRC /usr/local/bin/dequel"
fi

echo ""
echo ""
success "${BOLD}Dequel installed${NC}"
echo ""
echo "  ${BOLD}Config dir:${NC}    $INSTALL_DIR"
echo ""
echo "  ${BOLD}Usage:${NC}"
echo "    dequel start     Start the Dequel platform"
echo "    dequel stop      Stop all services"
echo "    dequel status    Show service status"
echo "    dequel logs      Follow logs"
echo "    dequel update    Pull latest images and restart"
echo "    dequel --help    Show all commands"
echo ""
echo "  Run ${BOLD}dequel start${NC} to get going."
echo ""
