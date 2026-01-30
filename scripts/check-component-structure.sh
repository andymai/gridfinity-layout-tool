#!/usr/bin/env bash
# check-component-structure.sh - Enforce component folder structure
# BLOCKING: exits non-zero if violations are found
#
# Rules for src/components/ and src/shared/components/:
# 1. Component .tsx files must live inside a named folder (not bare at directory root)
# 2. Each component must have a sibling .test.tsx file

set -e

# Get staged TypeScript/TSX component files in scope
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | \
  grep -E '\.(tsx?)$' | \
  grep -E '^src/(components|shared/components)/' || true)

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

  # Determine the expected directory structure
  # For src/components/: files should be in src/components/ComponentName/
  # For src/shared/components/: files should be in src/shared/components/ComponentName/
  DIR=$(dirname "$FILE")

  # Check Rule 1: Component must be inside a named folder
  # A bare file at root would have DIR = "src/components" or "src/shared/components"
  if [ "$DIR" = "src/components" ] || [ "$DIR" = "src/shared/components" ]; then
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
  echo "  Components in src/components/ and src/shared/components/ must:"
  echo "    1. Live inside a named folder (e.g., MyComponent/MyComponent.tsx)"
  echo "    2. Have a sibling test file (e.g., MyComponent/MyComponent.test.tsx)"
  echo ""
  exit 1
fi

exit 0
