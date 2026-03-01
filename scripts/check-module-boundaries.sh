#!/bin/bash
#
# Module Boundary Checker
#
# Primary rule: NO CROSS-FEATURE IMPORTS
# Features in src/features/X can only import from:
#   - core/, shared/ (infrastructure)
#   - hooks/, utils/, components/ (app-level)
#   - features/X (same feature only)
#
# Cross-feature imports (features/A importing from features/B) are PROHIBITED
# as they create tight coupling between feature modules.
#
# Usage:
#   ./scripts/check-module-boundaries.sh           # Check all files
#   ./scripts/check-module-boundaries.sh --staged  # Check only staged files
#   ./scripts/check-module-boundaries.sh file.ts   # Check specific file
#

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Allowed cross-feature imports — format: "source-feature:target-feature"
# Add entries here (with explanation) when intentional coupling is required.
ALLOWED_CROSS_FEATURE=(
  "design-linking:bin-designer" # Integration layer; imports must use @/features/bin-designer barrel only
)

VIOLATIONS_FOUND=0

# Get files to check
get_files() {
  if [[ "$1" == "--staged" ]]; then
    git diff --cached --name-only --diff-filter=ACM | grep -E '\.tsx?$' | grep '^src/' | grep -v '\.test\.' | grep -v '\.spec\.' || true
  elif [[ -n "$1" ]]; then
    echo "$1"
  else
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '__mocks__' || true
  fi
}

# Extract the feature name from a file path (if in features/)
get_feature() {
  local path="$1"
  if [[ "$path" =~ src/features/([^/]+)/ ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

# Check for cross-feature imports in a file
check_file() {
  local file="$1"
  local source_feature
  source_feature=$(get_feature "$file")

  # Skip files not in features/
  [[ -z "$source_feature" ]] && return 0

  # Extract all @/features imports.
  # Note: This pattern only matches single-line imports with standard string literals.
  # It will not detect imports that use template literals (backticks) or multi-line import statements.
  local imports
  imports=$(grep -E "from ['\"]@/features/[^'\"]+['\"]" "$file" 2>/dev/null || true)

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue

    # Extract the import path
    local import_path
    import_path=$(echo "$line" | sed -n "s|.*from ['\"]\\(@/features/[^'\"]*\\)['\"].*|\\1|p")
    [[ -z "$import_path" ]] && continue

    # Extract target feature name
    local target_feature
    target_feature=$(echo "$import_path" | sed 's|@/features/||' | cut -d'/' -f1)

    # Skip same-feature imports
    [[ "$target_feature" == "$source_feature" ]] && continue

    # Check against allowlist — barrel imports only
    local allowed=false
    for pair in "${ALLOWED_CROSS_FEATURE[@]}"; do
      if [[ "$pair" == "$source_feature:$target_feature" ]]; then
        # Only allow barrel imports (e.g. @/features/bin-designer), not deep paths
        if [[ "$import_path" == "@/features/$target_feature" ]]; then
          allowed=true
        else
          echo -e "${RED}VIOLATION${NC} $file"
          echo -e "  ${BLUE}features/$source_feature${NC} → ${YELLOW}features/$target_feature${NC}"
          echo -e "  Import: $import_path"
          echo -e "  ${YELLOW}Allowlisted pairs must use barrel import: @/features/$target_feature${NC}"
          echo ""
          ((VIOLATIONS_FOUND++))
          allowed=skip
        fi
        break
      fi
    done
    [[ "$allowed" == "true" || "$allowed" == "skip" ]] && continue

    # Cross-feature import violation
    local line_num
    line_num=$(grep -nE "from ['\"]$import_path['\"]" "$file" | head -1 | cut -d':' -f1)

    echo -e "${RED}VIOLATION${NC} $file:$line_num"
    echo -e "  ${BLUE}features/$source_feature${NC} → ${YELLOW}features/$target_feature${NC}"
    echo -e "  Import: $import_path"
    echo ""

    ((VIOLATIONS_FOUND++))
  done <<< "$imports"

  return 0
}

# Main
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Module Boundary Check - Cross-Feature Import Detection"
echo "═══════════════════════════════════════════════════════════════"
echo ""

FILES=$(get_files "$1")

if [[ -z "$FILES" ]]; then
  echo -e "${GREEN}✓${NC} No TypeScript files to check"
  exit 0
fi

FILE_COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
echo "Checking $FILE_COUNT files for cross-feature imports..."
echo ""

# Check each file
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  [[ ! -f "$file" ]] && continue
  check_file "$file"
done <<< "$FILES"

# Summary
echo "───────────────────────────────────────────────────────────────"
if [[ $VIOLATIONS_FOUND -eq 0 ]]; then
  echo -e "${GREEN}✓${NC} No cross-feature import violations found"
  echo ""
  exit 0
else
  echo -e "${RED}✗${NC} Found $VIOLATIONS_FOUND cross-feature import violation(s)"
  echo ""
  echo "Cross-feature imports create tight coupling between modules."
  echo "Instead:"
  echo "  • Move shared code to @/shared/ (utils, hooks, components)"
  echo "  • Move orchestration logic to @/hooks/ or @/components/"
  echo "  • Use dependency inversion (pass functions/components as props)"
  echo ""
  exit 1
fi
