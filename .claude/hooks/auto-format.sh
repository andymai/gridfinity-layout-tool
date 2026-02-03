#!/bin/bash
# Auto-format hook - runs prettier on edited files
# Trigger: PostToolUse on Edit|Write for ts/tsx/json/md/css files
# Exit codes: 0 = always (informational only)

# Read JSON input from stdin
INPUT=$(cat)

# Extract file path from JSON
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

# Skip if no file provided
[[ -z "$FILE" ]] && exit 0

# Only format supported file types
case "$FILE" in
  *.ts|*.tsx|*.json|*.md|*.css) ;;
  *) exit 0 ;;
esac

# Skip node_modules, dist, coverage
[[ "$FILE" == *node_modules* || "$FILE" == *dist/* || "$FILE" == *coverage/* ]] && exit 0

# Skip if file doesn't exist (was deleted)
[[ ! -f "$FILE" ]] && exit 0

# Get project root
PROJECT_ROOT=$(pwd)
[[ ! -f "$PROJECT_ROOT/package.json" ]] && exit 0

# Run prettier silently
cd "$PROJECT_ROOT"
OUTPUT=$(npx prettier --write "$FILE" 2>&1)
EXIT_CODE=$?

# Only report errors
if [[ $EXIT_CODE -ne 0 ]]; then
  echo "" >&2
  echo "⚠️  Prettier formatting failed for $(basename "$FILE")" >&2
  echo "─────────────────────────────────────" >&2
  echo "$OUTPUT" | tail -10 >&2
  echo "─────────────────────────────────────" >&2
fi

# Always exit 0 - PostToolUse hooks are informational
exit 0
