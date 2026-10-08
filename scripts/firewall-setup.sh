#!/usr/bin/env bash
set -euo pipefail

SSH_PORT="${SSH_PORT:-22}"

is_root() {
	[ "$(id -u)" -eq 0 ]
}

run_as_root() {
	if is_root; then
		"$@"
	elif command -v sudo >/dev/null 2>&1; then
		sudo "$@"
	else
		echo "Error: root privileges required" >&2
		exit 1
	fi
}

check_ufw_installed() {
	if ! command -v ufw >/dev/null 2>&1; then
		echo "ufw is not installed. Installing ufw..."
		if command -v apt-get >/dev/null 2>&1; then
			run_as_root apt-get update -qq && run_as_root apt-get install -y -qq ufw
		elif command -v yum >/dev/null 2>&1; then
			run_as_root yum install -y ufw
		else
			echo "Package manager not supported for automatic ufw installation. Please install ufw manually." >&2
			exit 1
		fi
	fi
}

configure_firewall() {
	check_ufw_installed

	echo "Configuring host firewall policies..."
	run_as_root ufw default deny incoming
	run_as_root ufw default allow outgoing

	echo "Allowing loopback interface..."
	run_as_root ufw allow in on lo

	echo "Allowing SSH on port ${SSH_PORT}..."
	run_as_root ufw allow "${SSH_PORT}/tcp"

	echo "Allowing HTTP (80) and HTTPS (443) ingress..."
	run_as_root ufw allow 80/tcp
	run_as_root ufw allow 443/tcp

	echo "Enabling UFW..."
	run_as_root ufw --force enable
	run_as_root ufw status verbose
	echo "Host firewall configured successfully."
}

show_status() {
	check_ufw_installed
	run_as_root ufw status verbose
}

main() {
	local action="${1:-setup}"
	case "$action" in
		setup|enable)
			configure_firewall
			;;
		status)
			show_status
			;;
		*)
			echo "Usage: $0 [setup|status]" >&2
			exit 1
			;;
	esac
}

main "$@"
