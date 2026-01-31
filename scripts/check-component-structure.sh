#!/usr/bin/env bash
# check-component-structure.sh - Enforce component folder structure
# BLOCKING: exits non-zero if violations are found
#
# Rules for ALL components/ directories under src/:
# 1. Component .tsx files must live inside a named folder (not bare at a components/ root)
# 2. Each component must have a sibling .test.tsx file

set -e

# Get staged .tsx/.ts files inside any components/ directory under src/
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | \
  grep -E '\.(tsx?)$' | \
  grep -E '^src(/[^/]*)*/components/' || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

VIOLATIONS=""
VIOLATION_COUNT=0

while IFS= read -r FILE; do
  # Skip deleted files
  [ ! -f "$FILE" ] && continue

  FILENAME=$(basename "$FILE")

  # Strip extension
  case "$FILENAME" in
    *.tsx) BASENAME="${FILENAME%.tsx}" ;;
    *.ts)  BASENAME="${FILENAME%.ts}" ;;
    *)     continue ;;
  esac

  # Skip non-component files
  case "$BASENAME" in
    index|types|constants) continue ;;
  esac

  # Skip test files themselves
  case "$FILENAME" in
    *.test.tsx|*.test.ts|*.spec.tsx|*.spec.ts) continue ;;
  esac

  # Skip __tests__/ directories
  case "$FILE" in
    */__tests__/*) continue ;;
  esac

  # Skip lowercase files (utilities like panelUtils.ts, not components)
  case "$BASENAME" in
    [a-z]*) continue ;;
  esac

  DIR=$(dirname "$FILE")
  DIRNAME=$(basename "$DIR")

  # Check Rule 1: Component must not be bare at a components/ root
  # A bare file has its parent directory literally named "components"
  if [ "$DIRNAME" = "components" ]; then
    VIOLATIONS="${VIOLATIONS}  ${FILE} (must be in a named folder, e.g., ${DIR}/${BASENAME}/${FILENAME})\n"
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
    continue
  fi

  # Check Rule 2: Sibling test file must exist
  if [ ! -f "${DIR}/${BASENAME}.test.ts" ] && [ ! -f "${DIR}/${BASENAME}.test.tsx" ]; then
    VIOLATIONS="${VIOLATIONS}  ${FILE} (missing sibling test: ${DIR}/${BASENAME}.test.tsx)\n"
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
  fi
done <<< "$STAGED_FILES"

if [ "$VIOLATION_COUNT" -gt 0 ]; then
  echo ""
  echo "Component structure violations ($VIOLATION_COUNT):"
  echo ""
  echo -e "$VIOLATIONS"
  echo "  All component .ts/.tsx files under any components/ directory must:"
  echo "    1. Live inside a named folder (not bare at the components/ root)"
  echo "    2. Have a sibling test file (e.g., MyComponent.test.tsx)"
  echo ""
  exit 1
fi

exit 0
