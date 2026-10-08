#!/usr/bin/env bash
set -euo pipefail

SSH_PORT="${SSH_PORT:-}"

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

detect_and_validate_ssh_port() {
	if [ -z "${SSH_PORT:-}" ]; then
		if [ -n "${SSH_CONNECTION:-}" ]; then
			local conn_port
			conn_port=$(echo "$SSH_CONNECTION" | awk '{print $4}')
			if [ -n "$conn_port" ] && [ "$conn_port" -gt 0 ] 2>/dev/null; then
				echo "Detected active SSH connection on port ${conn_port}."
				SSH_PORT="$conn_port"
			fi
		fi
	fi
	if [ -z "${SSH_PORT:-}" ]; then
		if command -v ss >/dev/null 2>&1; then
			local ss_port
			ss_port=$(ss -tlpn 2>/dev/null | grep -E 'sshd|/ssh' | awk '{print $4}' | awk -F: '{print $NF}' | head -n1 || true)
			if [ -n "$ss_port" ] && [ "$ss_port" -gt 0 ] 2>/dev/null; then
				echo "Detected listening SSH service on port ${ss_port}."
				SSH_PORT="$ss_port"
			fi
		fi
	fi
	SSH_PORT="${SSH_PORT:-22}"

	if ! [[ "${SSH_PORT}" =~ ^[0-9]+$ ]] || [ "${SSH_PORT}" -lt 1 ] || [ "${SSH_PORT}" -gt 65535 ]; then
		echo "Error: Invalid SSH port '${SSH_PORT}'. Must be an integer between 1 and 65535." >&2
		exit 1
	fi
}

configure_firewall() {
	check_ufw_installed
	detect_and_validate_ssh_port

	echo "Inspecting existing firewall rules..."
	run_as_root ufw status numbered || true

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
	echo "Updated firewall rules:"
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
