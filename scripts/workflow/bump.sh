#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION_FILE="$ROOT_DIR/VERSION"

validate_version() {
  local version="$1"
  if ! echo "$version" | grep -qP '^\d+\.\d+\.\d+$'; then
    echo "Error: Version must be in format MAJOR.MINOR.PATCH (e.g. 0.1.1). Got: $version"
    exit 1
  fi
}

print_header() {
  local current="$1"
  local new="$2"
  echo -e "${CYAN}Dequel Version Bump${NC}"
  echo -e "${YELLOW}Current version:${NC} $current"
  echo -e "${YELLOW}New version:${NC}     $new"
  echo ""
}

confirm_bump() {
  read -p "Proceed with bump? (y/N) " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]]
}

update_version_file() {
  local version="$1"
  echo "$version" > "$VERSION_FILE"
  echo -e "${GREEN}✓${NC} Updated VERSION → $version"
}

sync_package_jsons() {
  (cd "$ROOT_DIR" && bun run sync-versions)
  echo -e "${GREEN}✓${NC} Synced package.json files"
}

add_changelog_entry() {
  local version="$1"
  echo ""
  echo -e "${CYAN}Changelog entry${NC}"
  echo -e "Format: ${YELLOW}# Changelog entry title (empty to skip)${NC}"
  echo "Example: '### Added' or '### Fixed'"
  read -p "Section header: " -r header
  if [ -z "$header" ]; then
    return 1
  fi
  echo "Enter bullet points (one per line). Press Ctrl+D when done:"
  bullets=$(cat)
  if [ -z "$bullets" ]; then
    return 1
  fi
  local date
  date=$(date +%Y-%m-%d)
  local entry="\n## [$version] - $date\n\n$header\n"
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      entry="$entry\n- $line"
    fi
  done <<< "$bullets"
  sed -i'' "2a\\$entry" "$ROOT_DIR/CHANGELOG.md"
  echo -e "${GREEN}✓${NC} Added changelog entry"
}

print_summary() {
  local version="$1"
  local changelog_updated="$2"
  local branch="${3:-main}"
  echo ""
  echo -e "${CYAN}=== Summary ===${NC}"
  echo -e "  VERSION:        ${GREEN}$version${NC}"
  echo -e "  package.json:   ${GREEN}synced${NC}"
  if [ "$changelog_updated" = true ]; then
    echo -e "  CHANGELOG:      ${GREEN}updated${NC}"
  else
    echo -e "  CHANGELOG:      ${YELLOW}skipped${NC}"
  fi
  echo ""
  echo -e "Next steps:"
  echo -e "  ${YELLOW}1. Review CHANGELOG.md${NC}"
  echo -e "  ${YELLOW}2. Commit: git add -A && git commit -m \"chore: bump to v$version\"${NC}"
  echo -e "  ${YELLOW}3. Tag:    git tag v$version${NC}"
  echo -e "  ${YELLOW}4. Push:   git push origin $branch --tags${NC}"
}

main() {
  if [ $# -ne 1 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v0.1.1"
    exit 1
  fi

  local version="${1#v}"
  validate_version "$version"

  local current
  current=$(cat "$VERSION_FILE")

  print_header "$current" "$version"

  if ! confirm_bump; then
    echo "Aborted."
    exit 0
  fi

  update_version_file "$version"
  sync_package_jsons

  local changelog_updated=false
  if add_changelog_entry "$version"; then
    changelog_updated=true
  fi

  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

  print_summary "$version" "$changelog_updated" "$current_branch"
}

main "$@"
