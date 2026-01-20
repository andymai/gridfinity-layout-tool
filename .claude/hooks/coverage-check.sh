#!/bin/bash
# Coverage gap detection hook - warns about new code without tests
# Trigger: PreToolUse on Bash when command contains 'git commit'
# Non-blocking: always exits 0, just warns

# Read JSON input from stdin
INPUT=$(cat)

# Extract command from JSON
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only run for git commit commands
[[ "$COMMAND" != *"git commit"* ]] && exit 0

WARNINGS=""

# Check for new source files without corresponding test files
NEW_FILES=$(git diff --cached --name-only --diff-filter=A 2>/dev/null | grep -E '^src/.*\.(ts|tsx)$' | grep -v '\.test\.' | grep -v '\.d\.ts$')

for file in $NEW_FILES; do
  # Skip type definition files and index files
  [[ "$file" == *.d.ts ]] && continue
  [[ "$(basename "$file")" == "index.ts" ]] && continue
  [[ "$(basename "$file")" == "index.tsx" ]] && continue

  # Look for test file in various locations
  BASENAME=$(basename "$file" .tsx)
  BASENAME=${BASENAME%.ts}

  TEST_FOUND=false

  # Check same directory
  DIR=$(dirname "$file")
  [[ -f "${DIR}/${BASENAME}.test.tsx" ]] && TEST_FOUND=true
  [[ -f "${DIR}/${BASENAME}.test.ts" ]] && TEST_FOUND=true

  # Check src/test/ directory
  for path in "src/test/${BASENAME}.test.tsx" \
              "src/test/${BASENAME}.test.ts" \
              "src/test/components/${BASENAME}.test.tsx" \
              "src/test/hooks/${BASENAME}.test.ts" \
              "src/test/utils/${BASENAME}.test.ts"; do
    [[ -f "$path" ]] && TEST_FOUND=true && break
  done

  if [[ "$TEST_FOUND" == false ]]; then
    WARNINGS+="  📄 New file without tests: $file\n"
  fi
done

# Check for new exported functions in modified files
MODIFIED=$(git diff --cached --name-only --diff-filter=M 2>/dev/null | grep -E '^src/.*\.(ts|tsx)$' | grep -v '\.test\.' | grep -v '\.d\.ts$')

for file in $MODIFIED; do
  # Get new exports from the diff
  NEW_EXPORTS=$(git diff --cached "$file" 2>/dev/null | grep '^+' | grep -v '^+++' | grep -E 'export (function|const|class) ' | grep -oE '(function|const|class) [a-zA-Z0-9_]+' | awk '{print $2}')

  [[ -z "$NEW_EXPORTS" ]] && continue

  # Find the test file
  BASENAME=$(basename "$file" .tsx)
  BASENAME=${BASENAME%.ts}

  TEST_FILE=""
  DIR=$(dirname "$file")

  for path in "${DIR}/${BASENAME}.test.tsx" \
              "${DIR}/${BASENAME}.test.ts" \
              "src/test/${BASENAME}.test.tsx" \
              "src/test/${BASENAME}.test.ts" \
              "src/test/components/${BASENAME}.test.tsx" \
              "src/test/hooks/${BASENAME}.test.ts" \
              "src/test/utils/${BASENAME}.test.ts"; do
    if [[ -f "$path" ]]; then
      TEST_FILE="$path"
      break
    fi
  done

  # No test file - already warned about new files
  [[ -z "$TEST_FILE" ]] && continue

  for func in $NEW_EXPORTS; do
    # Skip internal/private functions (starting with _)
    [[ "$func" == _* ]] && continue

    if ! grep -q "$func" "$TEST_FILE" 2>/dev/null; then
      WARNINGS+="  🔧 New export '$func' in $file not found in tests\n"
    fi
  done
done

if [[ -n "$WARNINGS" ]]; then
  echo ""
  echo "📋 Test coverage gaps (warning only):"
  echo "─────────────────────────────────────"
  echo -e "$WARNINGS"
  echo "─────────────────────────────────────"
  echo "Consider adding tests for new code."
  echo ""
fi

# Always exit 0 - this is a warning, not a blocker
exit 0
