#!/bin/bash
# Silent auto-test hook - runs related tests after Edit/Write, only shows failures
# Trigger: PostToolUse on Edit|Write for src/**/*.{ts,tsx}
# Exit codes: 0 = allow (always), this is informational only

# Read JSON input from stdin
INPUT=$(cat)

# Extract file path from JSON using jq
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

# Skip if no file provided or jq not available
[[ -z "$FILE" ]] && exit 0

# Skip non-src files
[[ "$FILE" != */src/* && "$FILE" != src/* ]] && exit 0

# Skip test files themselves
[[ "$FILE" == *.test.* ]] && exit 0

# Skip non-TS/TSX files
[[ "$FILE" != *.ts && "$FILE" != *.tsx ]] && exit 0

# Get the project root (directory containing package.json)
PROJECT_ROOT=$(dirname "$(dirname "$(dirname "$FILE")")")
[[ ! -f "$PROJECT_ROOT/package.json" ]] && PROJECT_ROOT=$(pwd)

# Make file path relative to project root
REL_FILE="${FILE#$PROJECT_ROOT/}"

# Find related test file
TEST_FILE=""
if [[ "$REL_FILE" == *.tsx ]]; then
  TEST_FILE="${REL_FILE%.tsx}.test.tsx"
  [[ ! -f "$PROJECT_ROOT/$TEST_FILE" ]] && TEST_FILE="${REL_FILE%.tsx}.test.ts"
elif [[ "$REL_FILE" == *.ts ]]; then
  TEST_FILE="${REL_FILE%.ts}.test.ts"
  [[ ! -f "$PROJECT_ROOT/$TEST_FILE" ]] && TEST_FILE="${REL_FILE%.ts}.test.tsx"
fi

# Also check src/test/ directory for component tests
if [[ ! -f "$PROJECT_ROOT/$TEST_FILE" ]]; then
  BASENAME=$(basename "$REL_FILE" .tsx)
  BASENAME=${BASENAME%.ts}

  for path in "src/test/${BASENAME}.test.tsx" \
              "src/test/${BASENAME}.test.ts" \
              "src/test/components/${BASENAME}.test.tsx" \
              "src/test/hooks/${BASENAME}.test.ts" \
              "src/test/utils/${BASENAME}.test.ts"; do
    if [[ -f "$PROJECT_ROOT/$path" ]]; then
      TEST_FILE="$path"
      break
    fi
  done
fi

# No test file found - skip silently
[[ -z "$TEST_FILE" || ! -f "$PROJECT_ROOT/$TEST_FILE" ]] && exit 0

# Run tests silently, capture output
cd "$PROJECT_ROOT"
OUTPUT=$(pnpm run test:run -- --reporter=dot "$TEST_FILE" 2>&1)
EXIT_CODE=$?

# Only show output if tests failed
if [[ $EXIT_CODE -ne 0 ]]; then
  echo "" >&2
  echo "✗ Tests failed for $(basename "$TEST_FILE")" >&2
  echo "─────────────────────────────────────" >&2
  echo "$OUTPUT" | tail -30 >&2
  echo "─────────────────────────────────────" >&2
fi

# Always exit 0 - PostToolUse hooks are informational
exit 0
