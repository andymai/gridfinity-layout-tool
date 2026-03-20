#!/usr/bin/env bash
# check-missing-tests.sh - Warn about staged source files without sibling tests
# Non-blocking: always exits 0 (warns but does not fail commit)

set -e

# Get staged TypeScript/TSX source files (exclude test files, declarations, configs)
STAGED_SOURCE_FILES=$(git diff --cached --name-only --diff-filter=ACMR | \
  grep -E '\.(ts|tsx)$' | \
  grep -v '\.test\.' | \
  grep -v '\.spec\.' | \
  grep -v '\.d\.ts$' | \
  grep -v '\.config\.' | \
  grep -v '^e2e/' | \
  grep -v '^api/' | \
  grep -v '^scripts/' || true)

if [ -z "$STAGED_SOURCE_FILES" ]; then
  exit 0
fi

MISSING_TESTS=""
MISSING_COUNT=0

while IFS= read -r FILE; do
  # Skip deleted files
  [ ! -f "$FILE" ] && continue

  DIR=$(dirname "$FILE")
  FILENAME=$(basename "$FILE")

  # Strip extension (.ts or .tsx)
  case "$FILENAME" in
    *.tsx) BASENAME="${FILENAME%.tsx}" ;;
    *.ts)  BASENAME="${FILENAME%.ts}" ;;
    *)     continue ;;
  esac

  # Skip files that typically don't need sibling tests
  case "$BASENAME" in
    index|types|constants|vite-env) continue ;;
  esac
  case "$DIR" in
    src/i18n/locales*|src/shell/layouts*|src/shell/styles*|src/test*) continue ;;
  esac
  # Skip type-only directories
  case "$DIR" in
    */types) continue ;;
  esac

  # Check for sibling test file
  if [ ! -f "${DIR}/${BASENAME}.test.ts" ] && [ ! -f "${DIR}/${BASENAME}.test.tsx" ]; then
    MISSING_TESTS="${MISSING_TESTS}  ${FILE}\n"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done <<< "$STAGED_SOURCE_FILES"

if [ "$MISSING_COUNT" -gt 0 ]; then
  echo ""
  echo "⚠️  Missing sibling tests ($MISSING_COUNT file(s)):"
  echo ""
  if [ "$MISSING_COUNT" -le 10 ]; then
    echo -e "$MISSING_TESTS"
  else
    echo -e "$MISSING_TESTS" | head -10
    echo "  ... and $((MISSING_COUNT - 10)) more"
  fi
  echo "  (This is a warning — commit will proceed)"
  echo ""
fi

exit 0
