#!/bin/bash
# Auto-Sync script: Stages, commits, and pushes any local code changes to GitHub

if [ -n "$(git status --porcelain)" ]; then
  MSG="${1:-Auto-update: $(date '+%Y-%m-%d %H:%M:%S')}"
  git add .
  git commit -m "$MSG"
  git push origin main
  echo "✅ Automatically updated and pushed changes to GitHub: $MSG"
else
  echo "ℹ️ Working tree clean. Nothing to sync."
fi
