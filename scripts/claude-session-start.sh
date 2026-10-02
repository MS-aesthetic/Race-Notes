#!/bin/bash
# Claude Code SessionStart hook: install deps in cloud sessions only.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund >/dev/null 2>&1
  git checkout -- package-lock.json 2>/dev/null || true   # npm re-stamps version; keep tree clean
fi
if [ ! -f .env.local ]; then
  echo "Note: .env.local missing. Real 'npm run build' will abort. See .claude/skills/crewchief-verify." >&2
fi
exit 0
