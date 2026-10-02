---
name: auto-git-sync
description: >
  Automatically stage, commit, and push project changes to GitHub after the user
  approves or makes changes. Triggers on phrases like "sync", "push to github",
  "commit my changes", "push changes", "auto sync", "update github", or after
  any code editing session where the user says to proceed or confirms changes.
---

# Auto GitHub Sync Skill

## Purpose
After any approved code change to the Smart RFID Library System, automatically:
1. Validate builds (only the parts that changed)
2. Commit with a descriptive message
3. Push to `origin/main`
4. Verify the push succeeded

## When This Skill Triggers
- User says: "sync", "push", "commit", "push to github", "update github", "auto-sync"
- After a multi-file editing session when user says "done", "proceed", "looks good"
- Explicitly: "push my changes to github"

## Execution Steps

### Step 1 — Check Git Status
Run and read the output of:
```bash
cd /Users/nikhilroule/Desktop/smart-rfid-library-system
git status --short
git diff --stat HEAD
```

**If working tree is clean**: tell the user and stop. Nothing to push.

**If there are changes**: list them clearly and proceed.

### Step 2 — Safety Checks (STOP if any fail)

1. **Conflict markers**: grep for `<<<<<<<` in `*.ts`, `*.tsx`, `*.json` files (excluding `node_modules`, `.git`). If found → STOP, report which files.

2. **Branch check**: confirm we are on `main` branch:
   ```bash
   git rev-parse --abbrev-ref HEAD
   ```

3. **Remote sync**: run `git pull --ff-only origin main`. If this fails (diverged history) → STOP, tell user to resolve manually.

### Step 3 — Build Validation

Only validate the parts of the project that actually changed:

- **If any `server/` files changed**:
  ```bash
  cd /Users/nikhilroule/Desktop/smart-rfid-library-system/server
  npm run build
  ```
  If this fails → STOP, show the TypeScript errors, do NOT commit.

- **If any `client/` files changed**:
  ```bash
  cd /Users/nikhilroule/Desktop/smart-rfid-library-system/client
  npm run build
  ```
  If this fails → STOP, show errors, do NOT commit.

### Step 4 — Generate Commit Message

Use the pattern: `type(scope): description`

Examples based on what changed:
- `fix(client): correct fetchDropdownData reference in IssueReturn`
- `feat(server): add Railway Railpack deployment config`
- `chore(client,server): update env var configuration for Vercel/Railway`
- `fix(server): move typescript to dependencies for Railway build`

Rules:
- Use `fix:` for bug fixes
- Use `feat:` for new features
- Use `chore:` for config/tooling changes
- Use `docs:` for README/docs only
- Keep it under 72 characters
- If user provided a custom message, use theirs exactly

### Step 5 — Stage, Commit, Push

```bash
cd /Users/nikhilroule/Desktop/smart-rfid-library-system

# Stage all changes (respects .gitignore automatically)
git add -A

# Show what will be committed
git diff --cached --stat

# Commit
git commit -m "<generated message>"

# Push
git push origin main
```

### Step 6 — Verify Push Succeeded

```bash
git ls-remote origin main
git rev-parse HEAD
```

Compare the two SHAs. If they match → success. If not → warn user.

Report the short commit SHA and commit message.

## What NEVER to Do
- Never `git push --force`
- Never delete files with `git rm` unless the user explicitly asked to delete them
- Never commit `node_modules/`, `.env`, `*.sqlite`, `dist/` (covered by `.gitignore`)
- Never push if builds fail
- Never push if there are conflict markers

## Fallback — Run the Script Directly
If any step is unclear, run the pre-built sync script instead:
```bash
cd /Users/nikhilroule/Desktop/smart-rfid-library-system
./scripts/sync.sh "your commit message here"
```

Or with dry-run to preview:
```bash
./scripts/sync.sh --dry-run
```
