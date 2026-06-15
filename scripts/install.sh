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
		http_code=$(curl -fsSL -w "%{http_code}" "$src" -o "$dst" 2>/dev/null) || {
			warn "Failed to download $src (HTTP $http_code)"
			return 1
		}
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

sample_machine_id() {
	if [ -f /etc/machine-id ]; then
		cat /etc/machine-id
	elif command -v hostname &>/dev/null; then
		hostname
	else
		uuidgen 2>/dev/null || echo "unknown"
	fi
}

posthog_track_install() {
	local version="$1"
	local install_marker="$INSTALL_DIR/.install-id"
	if [ -f "$install_marker" ]; then
		return
	fi

	local mid
	mid="$(sample_machine_id)"
	local distinct_id="install-$(printf '%s' "$mid" | sha256sum 2>/dev/null | cut -c1-32)"
	if [ -z "$distinct_id" ]; then
		distinct_id="install-$(uuidgen 2>/dev/null || date +%s)"
	fi

	local key="${POSTHOG_API_KEY:-__POSTHOG_API_KEY__}"
	# If the placeholder wasn't replaced at release time, skip silently
	if echo "$key" | grep -q "^__"; then
		echo "$distinct_id" > "$install_marker"
		return
	fi
	if [ -z "$key" ]; then
		echo "$distinct_id" > "$install_marker"
		return
	fi

	# Fire and forget — one-shot at install time, never again
	curl -fsSL -X POST "https://us.i.posthog.com/capture" \
		-H "Content-Type: application/json" \
		-d "{\"api_key\":\"$key\",\"event\":\"dequel_installed\",\"distinct_id\":\"$distinct_id\",\"properties\":{\"version\":\"$version\"}}" \
		>/dev/null 2>&1 || true

	echo "$distinct_id" > "$install_marker"
}

resolve_base_url() {
	header "Downloading configuration"
	TAG=""

	if [ "$VERSION" = "latest" ]; then
		local release_url="https://api.github.com/repos/$REPO/releases/latest"
		info "Fetching latest release..."
		TAG=$(curl -fsSL "$release_url" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/') || true
		if [ -z "$TAG" ]; then
			warn "Could not determine latest release. Falling back to 'main' branch."
			BASE_URL="https://raw.githubusercontent.com/$REPO/main"
		else
			BASE_URL="https://raw.githubusercontent.com/$REPO/$TAG"
			success "Latest release: $TAG"
		fi
	else
		TAG="v$VERSION"
		BASE_URL="https://raw.githubusercontent.com/$REPO/$TAG"
	fi
}

download_configs() {
	resolve_base_url

	if [ -n "$TAG" ]; then
		local version="${TAG#v}"
		local tarball_url="https://github.com/$REPO/releases/download/$TAG/dequel-config-$version.tar.gz"
		local tarball_path=$(mktemp)
		info "Downloading config bundle..."
		set +e
		http_code=$(curl -fsSL -w "%{http_code}" "$tarball_url" -o "$tarball_path" 2>/dev/null)
		curl_ok=$?
		set -e
		if [ "$curl_ok" -eq 0 ] && [ "$http_code" = "200" ]; then
			tar -xzf "$tarball_path" -C "$INSTALL_DIR"
			rm -f "$tarball_path"
			chmod +x "$INSTALL_DIR/dequel" 2>/dev/null || true
			success "Downloaded and extracted config bundle"
			return
		fi
		rm -f "$tarball_path"
		warn "Could not download config bundle (HTTP $http_code), falling back to individual files"
	fi

	download_if_missing "$BASE_URL/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"
	download_if_missing "$BASE_URL/infra/caddy/Caddyfile" "$INSTALL_DIR/infra/caddy/Caddyfile"
	download_if_missing "$BASE_URL/scripts/dequel" "$INSTALL_DIR/dequel"

	for f in prometheus.yml loki-config.yml promtail-config.yml; do
		download_if_missing "$BASE_URL/infra/monitoring/$f" "$INSTALL_DIR/infra/monitoring/$f"
	done

	for f in loki.yml prometheus.yml; do
		download_if_missing "$BASE_URL/infra/monitoring/grafana/datasources/$f" "$INSTALL_DIR/infra/monitoring/grafana/datasources/$f"
	done
}

prompt_config() {
	header "Configuration"

	if [ ! -t 0 ]; then
		warn "Non-interactive mode: skipping configuration prompt"
		warn "Set CADDY_EMAIL and CADDY_BASE_DOMAIN manually in $INSTALL_DIR/.env"
		return
	fi

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
	if [ ! -f "$cli_src" ]; then
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

	local version="${TAG#v}"
	[ -z "$version" ] && version="latest"
	posthog_track_install "$version"

	print_summary
}

main
