#!/usr/bin/env bash
# scripts/publish.sh — publish @thupham/volley-core + @thupham/volley-mcp to npm.
#
# This is the local single-platform publish path. For cross-platform releases
# (8 targets), push a v* tag and let .github/workflows/release.yml do it.
#
# Flow:
#   1. Verify npm login + @thupham scope access.
#   2. Build the Rust native addon for the current platform (napi build --release).
#   3. Publish @thupham/volley-core + the platform-specific package
#      (e.g. @thupham/volley-core-darwin-arm64) via `napi prepublish -t npm`.
#   4. Build the TypeScript MCP server (tsc).
#   5. Publish @thupham/volley-mcp via `pnpm publish` (replaces workspace:*
#      with the real version automatically).
#
# Usage:
#   scripts/publish.sh                     # build + publish both packages
#   scripts/publish.sh --core              # only @thupham/volley-core
#   scripts/publish.sh --mcp               # only @thupham/volley-mcp
#   scripts/publish.sh --dry-run           # npm publish --dry-run (no actual upload)
#   scripts/publish.sh --no-build          # skip builds, publish already-built artifacts
#   scripts/publish.sh --otp=123456        # pass 2FA OTP to npm publish
#   scripts/publish.sh --access=restricted # publish as private (default: public)
#   scripts/publish.sh -h, --help
#
# Requirements:
#   - npm login (npm whoami must succeed)
#   - membership in the @thupham npm org with publish permission
#   - pnpm, napi (@napi-rs/cli), rust toolchain installed

set -euo pipefail

# ─── Setup ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'; C_DIM=$'\033[2m'
else
  C_RESET=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_DIM=""
fi

log()  { printf '%s%s%s\n' "$C_BLUE" "$*" "$C_RESET" >&2; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*" >&2; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
err()  { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
die()  { err "$*"; exit 1; }

# ─── Args ───────────────────────────────────────────────────────────────────
DO_CORE=true
DO_MCP=true
DRY_RUN=false
NO_BUILD=false
OTP=""
ACCESS="public"

print_help() {
  sed -n '2,/^$/p' < "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    -h|--help) print_help ;;
    --core) DO_CORE=true; DO_MCP=false ;;
    --mcp)  DO_MCP=true;  DO_CORE=false ;;
    --dry-run) DRY_RUN=true ;;
    --no-build) NO_BUILD=true ;;
    --otp=*) OTP="${arg#--otp=}" ;;
    --access=*) ACCESS="${arg#--access=}" ;;
    *) die "Unknown argument: $arg (see --help)" ;;
  esac
done

# Build npm publish flags.
PUBLISH_FLAGS=("--access" "$ACCESS")
if $DRY_RUN; then
  PUBLISH_FLAGS+=("--dry-run")
fi
if [ -n "$OTP" ]; then
  PUBLISH_FLAGS+=("--otp" "$OTP")
fi

# ─── Pre-flight ─────────────────────────────────────────────────────────────
printf '%s%sVolley publish%s\n' "$C_BOLD" "$C_BLUE" "$C_RESET" >&2
printf '  %sScope:   %s %s%s%s\n' "$C_DIM" "$C_RESET" "$C_BLUE" "@thupham" "$C_RESET" >&2
printf '  %sDry run: %s %s\n' "$C_DIM" "$C_RESET" "$($DRY_RUN && echo yes || echo no)" >&2
printf '  %sBuild:   %s %s\n' "$C_DIM" "$C_RESET" "$($NO_BUILD && echo skip || echo yes)" >&2
printf '  %sAccess:  %s %s\n' "$C_DIM" "$C_RESET" "$ACCESS" >&2
printf '  %sTargets: %s' "$C_DIM" "$C_RESET" >&2
$DO_CORE && printf '%s core%s' "$C_BLUE" "$C_RESET" >&2
$DO_MCP   && printf '%s mcp%s'  "$C_BLUE" "$C_RESET" >&2
printf '\n\n' >&2

# npm login check.
if ! npm whoami >/dev/null 2>&1; then
  die "Not logged in to npm. Run: npm login"
fi
NPM_USER="$(npm whoami)"
ok "npm logged in as: $NPM_USER"

# Verify the user can publish to @thupham by reading org membership.
# (Best-effort — if this fails for non-org reasons, we still proceed and let
# npm publish surface the real auth error.)
if npm org ls thupham "$NPM_USER" >/dev/null 2>&1; then
  ok "Confirmed @thupham org membership"
else
  warn "Could not verify @thupham org membership (npm org ls failed)."
  warn "If you are not a member with publish permission, the publish step will fail."
fi

# Read current versions.
CORE_VERSION="$(grep -m1 -E '"version"' crates/core/package.json \
  | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
MCP_VERSION="$(grep -m1 -E '"version"' packages/mcp-server/package.json \
  | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"

[ -n "$CORE_VERSION" ] || die "Could not read @thupham/volley-core version"
[ -n "$MCP_VERSION" ]  || die "Could not read @thupham/volley-mcp version"

log "@thupham/volley-core @ $CORE_VERSION"
log "@thupham/volley-mcp  @ $MCP_VERSION"
printf '\n' >&2

# ─── Publish @thupham/volley-core ───────────────────────────────────────────
if $DO_CORE; then
  printf '%s%s─ @thupham/volley-core ─%s\n' "$C_BOLD" "$C_BLUE" "$C_RESET" >&2

  if ! $NO_BUILD; then
    log "Building native addon (current platform, release)..."
    (
      cd crates/core
      pnpm exec napi build --platform --release
    ) || die "napi build failed for @thupham/volley-core"
    ok "Native addon built"
  else
    warn "Skipping build (--no-build); using existing artifacts"
    [ -f crates/core/index.js ] || die "crates/core/index.js missing. Run without --no-build first."
  fi

  log "Publishing @thupham/volley-core + platform package via napi prepublish..."
  if $DRY_RUN; then
    # napi prepublish doesn't have a --dry-run flag; show what it would do.
    warn "Dry run: skipping actual napi prepublish"
    printf '  %s→%s pnpm exec napi prepublish -t npm (in crates/core/)\n' "$C_DIM" "$C_RESET" >&2
  else
    NAPI_PUBLISH_FLAGS=("-t" "npm" "--no-gh-release")
    if [ -n "$OTP" ]; then
      NAPI_PUBLISH_FLAGS+=("--otp" "$OTP")
    fi
    (
      cd crates/core
      pnpm exec napi prepublish "${NAPI_PUBLISH_FLAGS[@]}"
    ) || die "napi prepublish failed for @thupham/volley-core"
    ok "Published @thupham/volley-core@$CORE_VERSION"
  fi
  printf '\n' >&2
fi

# ─── Publish @thupham/volley-mcp ────────────────────────────────────────────
if $DO_MCP; then
  printf '%s%s─ @thupham/volley-mcp ─%s\n' "$C_BOLD" "$C_BLUE" "$C_RESET" >&2

  if ! $NO_BUILD; then
    log "Building TypeScript MCP server (tsc)..."
    (
      cd packages/mcp-server
      pnpm build
    ) || die "tsc build failed for @thupham/volley-mcp"
    ok "MCP server built"
  else
    warn "Skipping build (--no-build); using existing dist/"
    [ -d packages/mcp-server/dist ] || die "packages/mcp-server/dist missing. Run without --no-build first."
  fi

  log "Publishing @thupham/volley-mcp..."
  PNPM_PUBLISH_FLAGS=("publish" "--access" "$ACCESS" "--no-git-checks")
  if $DRY_RUN; then
    PNPM_PUBLISH_FLAGS+=("--dry-run")
  fi
  if [ -n "$OTP" ]; then
    PNPM_PUBLISH_FLAGS+=("--otp" "$OTP")
  fi
  (
    cd packages/mcp-server
    pnpm "${PNPM_PUBLISH_FLAGS[@]}"
  ) || die "pnpm publish failed for @thupham/volley-mcp"
  ok "Published @thupham/volley-mcp@$MCP_VERSION"
  printf '\n' >&2
fi

# ─── Summary ────────────────────────────────────────────────────────────────
printf '%s%sDone!%s Published:\n' "$C_BOLD" "$C_GREEN" "$C_RESET" >&2
$DO_CORE && printf '  • @thupham/volley-core@%s (current platform only)\n' "$CORE_VERSION" >&2
$DO_MCP   && printf '  • @thupham/volley-mcp@%s\n'  "$MCP_VERSION"  >&2
printf '\n%sFor cross-platform releases, push a tag to trigger CI:%s\n' "$C_DIM" "$C_RESET" >&2
printf '  git tag v%s\n' "$MCP_VERSION" >&2
printf '  git push origin v%s\n\n' "$MCP_VERSION" >&2

if $DO_CORE; then
  printf '%sVerify:%s npx -y @thupham/volley-mcp\n' "$C_DIM" "$C_RESET" >&2
fi
