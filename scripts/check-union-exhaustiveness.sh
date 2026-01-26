#!/bin/bash
#
# Union Type Exhaustiveness Checker
#
# Detects switch/if-else on discriminated union types that don't handle all cases.
# Prevents runtime crashes from unhandled cases (like the ValidationReason bug in d5f692f).
#
# Usage:
#   ./scripts/check-union-exhaustiveness.sh           # Check all staged files
#   ./scripts/check-union-exhaustiveness.sh --all     # Check all source files
#   ./scripts/check-union-exhaustiveness.sh file.ts   # Check specific file
#

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Define known union types and their members
declare -A UNION_TYPES=(
  ["ValidationReason"]="out_of_bounds,exceeds_width,exceeds_depth,exceeds_height,invalid_layer,collision,blocked_zone"
  ["ToastType"]="success,error,info"
  ["LayerViewMode"]="focus,stack,all"
  ["DropTarget"]="trash,staging"
  ["EditSource"]="local,remote,init"
  ["MobileLayersTab"]="layers,tools"
)

# Get files to check
get_files() {
  if [[ "$1" == "--all" ]]; then
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) | grep -v '\.test\.' | grep -v '__mocks__'
  elif [[ -n "$1" ]]; then
    echo "$1"
  else
    # Staged files only
    git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'
  fi
}

ISSUES=""
FILES=$(get_files "$1")

if [[ -z "$FILES" ]]; then
  echo -e "${GREEN}✓${NC} No TypeScript files to check"
  exit 0
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Union Type Exhaustiveness Check"
echo "═══════════════════════════════════════════════════════════════"
echo ""

FILE_COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
echo "Checking $FILE_COUNT files..."
echo ""

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  [[ ! -f "$file" ]] && continue

  CONTENT=$(cat "$file")

  for TYPE_NAME in "${!UNION_TYPES[@]}"; do
    # Skip if this type isn't used in the file
    if ! echo "$CONTENT" | grep -q "$TYPE_NAME"; then
      continue
    fi

    MEMBERS="${UNION_TYPES[$TYPE_NAME]}"
    IFS=',' read -ra MEMBER_ARRAY <<< "$MEMBERS"

    # Find switch statements that use this type's members
    SWITCH_POSITIONS=$(echo "$CONTENT" | grep -n 'switch\s*(' | cut -d: -f1)

    for line_num in $SWITCH_POSITIONS; do
      [[ -z "$line_num" ]] && continue

      # Get context: 60 lines after the switch
      SWITCH_CONTEXT=$(echo "$CONTENT" | tail -n +"$line_num" | head -60)

      # Check if this switch uses any of our union members
      USES_TYPE=false
      for member in "${MEMBER_ARRAY[@]}"; do
        if echo "$SWITCH_CONTEXT" | grep -qE "case\s*['\"]${member}['\"]"; then
          USES_TYPE=true
          break
        fi
      done

      if [[ "$USES_TYPE" == "true" ]]; then
        MISSING_CASES=""

        for member in "${MEMBER_ARRAY[@]}"; do
          if ! echo "$SWITCH_CONTEXT" | grep -qE "case\s*['\"]${member}['\"]"; then
            MISSING_CASES+="$member, "
          fi
        done

        # Check for default or exhaustive check
        HAS_DEFAULT=false
        echo "$SWITCH_CONTEXT" | grep -qE '^\s*default\s*:' && HAS_DEFAULT=true

        HAS_EXHAUSTIVE=false
        echo "$SWITCH_CONTEXT" | grep -qiE 'assertNever|exhaustive|: never' && HAS_EXHAUSTIVE=true

        if [[ -n "$MISSING_CASES" ]] && [[ "$HAS_DEFAULT" == "false" ]] && [[ "$HAS_EXHAUSTIVE" == "false" ]]; then
          MISSING_CASES="${MISSING_CASES%, }"
          ISSUES+="${RED}VIOLATION${NC} $file:$line_num\n"
          ISSUES+="  switch on ${YELLOW}$TYPE_NAME${NC} missing cases: ${RED}$MISSING_CASES${NC}\n\n"
        fi
      fi
    done
  done
done <<< "$FILES"

echo "───────────────────────────────────────────────────────────────"

if [[ -z "$ISSUES" ]]; then
  echo -e "${GREEN}✓${NC} No exhaustiveness issues found"
  echo ""
  exit 0
else
  echo -e "${RED}✗${NC} Exhaustiveness issues found:"
  echo ""
  echo -e "$ISSUES"
  echo "Fix by adding missing cases or a default with exhaustive check:"
  echo ""
  echo "  default:"
  echo "    const _exhaustive: never = value;"
  echo "    throw new Error(\`Unhandled case: \${value}\`);"
  echo ""
  exit 1
fi
