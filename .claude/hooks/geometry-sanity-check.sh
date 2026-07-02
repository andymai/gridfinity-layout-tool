#!/bin/bash
# Geometry sanity check - reminds to run scenario tests when geometry-critical files are edited
# Trigger: PostToolUse on Edit|Write
# Exit codes: 0 = allow (informational only, never blocks)

# Read JSON input from stdin
INPUT=$(cat)

# Extract the file path from the tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null)

# No file path - nothing to check
[[ -z "$FILE_PATH" ]] && exit 0

# Geometry-critical file patterns
GEOMETRY_FILES=(
  "binGenerator"
  "slotBuilder"
  "dividerBuilder"
  "hexGrid"
  "wallPatterns"
)

# Check if the edited file matches any geometry-critical pattern
MATCH=false
for pattern in "${GEOMETRY_FILES[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    MATCH=true
    break
  fi
done

[[ "$MATCH" == "false" ]] && exit 0

# Informational reminder (non-blocking)
echo "" >&2
echo "Geometry-critical file edited: $(basename "$FILE_PATH")" >&2
echo "Remember to run scenario tests to validate geometry output:" >&2
echo "  pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario" >&2
echo "" >&2

exit 0
