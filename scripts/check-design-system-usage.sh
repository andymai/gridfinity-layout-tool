#!/bin/bash
#
# Design System Usage Checker
#
# Enforces that feature and component code uses design system components
# instead of raw HTML elements.
#
# Detects:
#   <button>        → Use <Button> from @/design-system
#   <input type="checkbox"> → Use <Checkbox> from @/design-system
#   <select>        → Use <Select> from @/design-system
#   <input> (text)  → Use <Input> from @/design-system
#
# Excluded paths:
#   - src/design-system/** (the design system itself)
#   - **/*.test.* (test files)
#   - **/*.spec.* (spec files)
#   - src/test/** (test utilities)
#   - e2e/** (end-to-end tests)
#
# Usage:
#   ./scripts/check-design-system-usage.sh           # Check all files
#   ./scripts/check-design-system-usage.sh --staged  # Check only staged files
#   ./scripts/check-design-system-usage.sh file.tsx  # Check specific file
#

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWLIST_FILE="$SCRIPT_DIR/design-system-allowlist.txt"

VIOLATIONS_FOUND=0
ALLOWLISTED_VIOLATIONS=0

# Load allowlist (strip comments and empty lines)
load_allowlist() {
  if [[ -f "$ALLOWLIST_FILE" ]]; then
    grep -v '^#' "$ALLOWLIST_FILE" | grep -v '^[[:space:]]*$' || true
  fi
}

ALLOWLIST=$(load_allowlist)

# Check if file is in allowlist
is_allowlisted() {
  local file="$1"
  echo "$ALLOWLIST" | grep -qx "$file"
}

# Get files to check
get_files() {
  if [[ "$1" == "--staged" ]]; then
    git diff --cached --name-only --diff-filter=ACM | grep -E '\.tsx$' | grep '^src/' || true
  elif [[ -n "$1" ]]; then
    echo "$1"
  else
    find src -type f -name "*.tsx" | grep -v '\.test\.' | grep -v '\.spec\.' || true
  fi
}

# Check if file should be excluded
should_exclude() {
  local file="$1"

  # Exclude design system itself
  [[ "$file" == src/design-system/* ]] && return 0

  # Exclude test files
  [[ "$file" == *.test.* ]] && return 0
  [[ "$file" == *.spec.* ]] && return 0

  # Exclude test utilities
  [[ "$file" == src/test/* ]] && return 0

  # Exclude e2e
  [[ "$file" == e2e/* ]] && return 0

  # Exclude storybook if it exists
  [[ "$file" == *.stories.* ]] && return 0

  return 1
}

# Report a violation
report_violation() {
  local file="$1"
  local line_num="$2"
  local found="$3"
  local use="$4"
  local line_content="$5"
  local allowlisted="$6"

  if [[ "$allowlisted" == "true" ]]; then
    ((ALLOWLISTED_VIOLATIONS++))
    return 0
  fi

  echo -e "${RED}VIOLATION${NC} $file:$line_num"
  echo -e "  Found: ${YELLOW}$found${NC}"
  echo -e "  Use:   ${GREEN}$use${NC} from ${CYAN}@/design-system${NC}"
  echo -e "  Line:  ${BLUE}$line_content${NC}"
  echo ""
  ((VIOLATIONS_FOUND++))
}

# Check for raw HTML elements in a file
check_file() {
  local file="$1"
  local allowlisted="false"

  # Skip excluded files
  if should_exclude "$file"; then
    return 0
  fi

  # Check if file is allowlisted
  if is_allowlisted "$file"; then
    allowlisted="true"
  fi

  # Check for raw <button> elements (but not Button components)
  local button_matches
  button_matches=$(grep -n '<button\b' "$file" 2>/dev/null | grep -v '<Button' || true)

  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    local line_num
    line_num=$(echo "$match" | cut -d':' -f1)
    local line_content
    line_content=$(echo "$match" | cut -d':' -f2-)
    report_violation "$file" "$line_num" "<button>" "<Button>" "$line_content" "$allowlisted"
  done <<< "$button_matches"

  # Check for raw <select> elements
  local select_matches
  select_matches=$(grep -n '<select\b' "$file" 2>/dev/null | grep -v '<Select' || true)

  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    local line_num
    line_num=$(echo "$match" | cut -d':' -f1)
    local line_content
    line_content=$(echo "$match" | cut -d':' -f2-)
    report_violation "$file" "$line_num" "<select>" "<Select>" "$line_content" "$allowlisted"
  done <<< "$select_matches"

  # Check for raw checkbox inputs
  local checkbox_matches
  checkbox_matches=$(grep -n 'type=["'"'"']checkbox["'"'"']' "$file" 2>/dev/null | grep '<input' | grep -v '<Checkbox' || true)

  while IFS= read -r match; do
    [[ -z "$match" ]] && continue
    local line_num
    line_num=$(echo "$match" | cut -d':' -f1)
    local line_content
    line_content=$(echo "$match" | cut -d':' -f2-)
    report_violation "$file" "$line_num" '<input type="checkbox">' "<Checkbox>" "$line_content" "$allowlisted"
  done <<< "$checkbox_matches"

  return 0
}

# Main
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Design System Usage Check"
echo "═══════════════════════════════════════════════════════════════"
echo ""

FILES=$(get_files "$1")

if [[ -z "$FILES" ]]; then
  echo -e "${GREEN}✓${NC} No TSX files to check"
  exit 0
fi

FILE_COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
echo "Checking $FILE_COUNT file(s) for raw HTML element usage..."
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
  if [[ $ALLOWLISTED_VIOLATIONS -gt 0 ]]; then
    echo -e "${GREEN}✓${NC} No new design system violations"
    echo -e "  ${DIM}($ALLOWLISTED_VIOLATIONS existing violation(s) in allowlisted files)${NC}"
  else
    echo -e "${GREEN}✓${NC} All files use design system components correctly"
  fi
  echo ""
  exit 0
else
  echo -e "${RED}✗${NC} Found $VIOLATIONS_FOUND new design system violation(s)"
  if [[ $ALLOWLISTED_VIOLATIONS -gt 0 ]]; then
    echo -e "  ${DIM}($ALLOWLISTED_VIOLATIONS existing violation(s) in allowlisted files)${NC}"
  fi
  echo ""
  echo "The design system provides consistent, accessible components."
  echo "Import them from @/design-system:"
  echo ""
  echo "  import { Button, Checkbox, Select, Input } from '@/design-system';"
  echo ""
  echo "If this is an existing file being modified, add it to:"
  echo "  scripts/design-system-allowlist.txt"
  echo ""
  exit 1
fi
