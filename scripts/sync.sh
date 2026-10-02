#!/usr/bin/env bash
# =============================================================================
# Smart RFID Library System — Auto GitHub Sync Script
# Usage:
#   ./scripts/sync.sh                    → auto-generates commit message
#   ./scripts/sync.sh "your message"     → uses custom commit message
#   ./scripts/sync.sh --dry-run          → preview only, no push
# =============================================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=false
CUSTOM_MSG=""

for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN=true
  else
    CUSTOM_MSG="$arg"
  fi
done

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'
log_info()    { echo -e "${CYAN}ℹ  $1${RESET}"; }
log_success() { echo -e "${GREEN}✅ $1${RESET}"; }
log_warn()    { echo -e "${YELLOW}⚠  $1${RESET}"; }
log_error()   { echo -e "${RED}❌ $1${RESET}"; }

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════${RESET}"
echo -e "${CYAN}   Smart RFID Library — GitHub Auto Sync              ${RESET}"
echo -e "${CYAN}══════════════════════════════════════════════════════${RESET}"
echo ""

# ─── Step 1: Branch check ─────────────────────────────────────────────────────
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  log_warn "Current branch is '${CURRENT_BRANCH}', not 'main'."
  read -r -p "  Proceed anyway? [y/N] " confirm
  [[ "$confirm" != "y" && "$confirm" != "Y" ]] && { log_error "Aborted."; exit 1; }
fi

# ─── Step 2: Conflict marker check ───────────────────────────────────────────
CONFLICT_FILES=$(grep -rl "^<<<<<<< " --include="*.ts" --include="*.tsx" --include="*.json" . 2>/dev/null \
  | grep -v "node_modules" | grep -v "\.git" || true)
if [[ -n "$CONFLICT_FILES" ]]; then
  log_error "Merge conflict markers found — resolve before syncing:"
  echo "$CONFLICT_FILES"
  exit 1
fi

# ─── Step 3: Git status ───────────────────────────────────────────────────────
log_info "Checking working tree..."
GIT_STATUS="$(git status --porcelain)"

if [[ -z "$GIT_STATUS" ]]; then
  log_success "Working tree is clean — nothing to sync."
  exit 0
fi

echo ""
log_info "Changed files:"
git status --short
echo ""

# ─── Step 4: Pull (fast-forward only) ────────────────────────────────────────
log_info "Pulling latest from origin/${CURRENT_BRANCH}..."
if ! git pull --ff-only origin "$CURRENT_BRANCH" 2>&1; then
  log_error "Pull failed — upstream may have diverged. Run 'git pull' manually first."
  exit 1
fi
log_success "Up to date with remote."

# ─── Step 5: Build validation (only changed parts) ───────────────────────────
SERVER_CHANGED=false
CLIENT_CHANGED=false

echo "$GIT_STATUS" | grep -qE "server/" && SERVER_CHANGED=true || true
echo "$GIT_STATUS" | grep -qE "client/" && CLIENT_CHANGED=true || true

if [[ "$SERVER_CHANGED" == true ]]; then
  log_info "Server files changed — running tsc build check..."
  if ! (cd server && npm run build 2>&1); then
    log_error "Server build FAILED. Fix TypeScript errors before syncing."
    exit 1
  fi
  log_success "Server build passed."
fi

if [[ "$CLIENT_CHANGED" == true ]]; then
  log_info "Client files changed — running tsc + vite build check..."
  if ! (cd client && npm run build 2>&1); then
    log_error "Client build FAILED. Fix TypeScript errors before syncing."
    exit 1
  fi
  log_success "Client build passed."
fi

# ─── Step 6: Generate commit message ─────────────────────────────────────────
if [[ -n "$CUSTOM_MSG" ]]; then
  COMMIT_MSG="$CUSTOM_MSG"
else
  SCOPE_PARTS=()
  [[ "$SERVER_CHANGED" == true ]] && SCOPE_PARTS+=("server")
  [[ "$CLIENT_CHANGED" == true ]] && SCOPE_PARTS+=("client")
  echo "$GIT_STATUS" | grep -qE "\.agents/" && SCOPE_PARTS+=("skills")  || true
  echo "$GIT_STATUS" | grep -qE "scripts/"  && SCOPE_PARTS+=("scripts") || true
  echo "$GIT_STATUS" | grep -qE "database/" && SCOPE_PARTS+=("database") || true

  SCOPE_STR=""
  if [[ ${#SCOPE_PARTS[@]} -gt 0 ]]; then
    SCOPE_STR="($(IFS=', '; echo "${SCOPE_PARTS[*]}")) "
  fi

  # Count changes safely
  TOTAL_FILES=$(echo "$GIT_STATUS" | wc -l | tr -d ' ')
  TIMESTAMP="$(date '+%Y-%m-%d %H:%M')"
  COMMIT_MSG="chore: ${SCOPE_STR}auto-sync ${TOTAL_FILES} file(s) [${TIMESTAMP}]"
fi

echo ""
log_info "Commit message: \"${COMMIT_MSG}\""
echo ""

if [[ "$DRY_RUN" == true ]]; then
  log_warn "DRY RUN — nothing staged, committed, or pushed."
  exit 0
fi

# ─── Step 7: Stage all changes (respects .gitignore) ─────────────────────────
log_info "Staging changes..."
git add -A
log_info "Staged:"
git diff --cached --stat
echo ""

# ─── Step 8: Commit ───────────────────────────────────────────────────────────
log_info "Committing..."
if ! git commit -m "$COMMIT_MSG"; then
  log_error "Commit failed."
  exit 1
fi
log_success "Committed."

# ─── Step 9: Push ─────────────────────────────────────────────────────────────
log_info "Pushing to origin/${CURRENT_BRANCH}..."
if ! git push origin "$CURRENT_BRANCH" 2>&1; then
  log_error "Push FAILED. Commit exists locally. Run 'git push origin ${CURRENT_BRANCH}' manually."
  exit 1
fi

# ─── Step 10: Verify ──────────────────────────────────────────────────────────
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git ls-remote origin "$CURRENT_BRANCH" 2>/dev/null | awk '{print $1}')"

if [[ "$LOCAL_HEAD" == "$REMOTE_HEAD" ]]; then
  log_success "Verified: remote matches local HEAD (${LOCAL_HEAD:0:8})."
else
  log_warn "Remote SHA not yet updated — push may still be propagating. Check GitHub."
fi

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}   ✅ Sync complete! Commit: ${LOCAL_HEAD:0:8}             ${RESET}"
echo -e "${GREEN}══════════════════════════════════════════════════════${RESET}"
echo ""
