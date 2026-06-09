#!/usr/bin/env bash
set -euo pipefail

REPO="Lftobs/dequel"
VERSION="${VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.dequel}"

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

download_if_missing() {
	local src="$1" dst="$2"
	if [ -f "$dst" ]; then
		info "  Skipping (exists): $dst"
	else
		curl -fsSL "$src" -o "$dst" || warn "Could not download $src"
		success "Downloaded: $dst"
	fi
}

check_prerequisites() {
	header "Checking prerequisites"

	if command -v docker &>/dev/null; then
		success "Docker found: $(docker --version)"
	else
		fail "Docker is not installed. See https://docs.docker.com/engine/install/"
	fi

	if docker compose version &>/dev/null; then
		success "Docker Compose found: $(docker compose version)"
		COMPOSE_CMD="docker compose"
	elif docker-compose --version &>/dev/null; then
		success "docker-compose found: $(docker-compose --version)"
		warn "Consider upgrading to 'docker compose' (Docker Compose v2)"
		COMPOSE_CMD="docker-compose"
	else
		fail "Docker Compose is not installed. See https://docs.docker.com/compose/install/"
	fi
}

setup_directories() {
	header "Setting up installation directory"
	mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/workspace" "$INSTALL_DIR/infra/caddy/routes" "$INSTALL_DIR/infra/monitoring/grafana/datasources"
	info "Installing to: $INSTALL_DIR"
}

resolve_base_url() {
	header "Downloading configuration"

	if [ "$VERSION" = "latest" ]; then
		local release_url="https://api.github.com/repos/$REPO/releases/latest"
		info "Fetching latest release..."
		local tag
		tag=$(curl -fsSL "$release_url" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
		if [ -z "$tag" ]; then
			warn "Could not determine latest release. Falling back to 'main' branch."
			BASE_URL="https://raw.githubusercontent.com/$REPO/main"
		else
			BASE_URL="https://raw.githubusercontent.com/$REPO/$tag"
			success "Latest release: $tag"
		fi
	else
		BASE_URL="https://raw.githubusercontent.com/$REPO/v$VERSION"
	fi
}

download_configs() {
	resolve_base_url

	download_if_missing "$BASE_URL/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"
	download_if_missing "$BASE_URL/infra/caddy/Caddyfile" "$INSTALL_DIR/infra/caddy/Caddyfile"

	for f in prometheus.yml loki-config.yml promtail-config.yml; do
		download_if_missing "$BASE_URL/infra/monitoring/$f" "$INSTALL_DIR/infra/monitoring/$f"
	done

	for f in loki.yml prometheus.yml; do
		download_if_missing "$BASE_URL/infra/monitoring/grafana/datasources/$f" "$INSTALL_DIR/infra/monitoring/grafana/datasources/$f"
	done
}

prompt_config() {
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
}

pull_images() {
	header "Pulling Docker images"
	$COMPOSE_CMD -f "$INSTALL_DIR/docker-compose.yml" pull || warn "Some images could not be pulled (they will be built on first run)"
}

install_cli() {
	header "Installing dequel CLI"
	local cli_src="$INSTALL_DIR/dequel"
	if [ -f "$cli_src" ]; then
		info "CLI already downloaded."
	else
		download_if_missing "$BASE_URL/scripts/dequel" "$cli_src"
	fi
	chmod +x "$cli_src"

	if [ -w /usr/local/bin ]; then
		ln -sf "$cli_src" /usr/local/bin/dequel
		success "Installed: /usr/local/bin/dequel"
	else
		info "Installed at: $cli_src"
		warn "Add to PATH manually: sudo ln -s $cli_src /usr/local/bin/dequel"
	fi
}

print_summary() {
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
}

main() {
	echo ""
	echo "${BOLD}  Dequel Installer${NC}"
	echo ""

	check_prerequisites
	setup_directories
	download_configs
	prompt_config
	pull_images
	install_cli
	print_summary
}

main
