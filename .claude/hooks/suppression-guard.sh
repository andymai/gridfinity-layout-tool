#!/bin/bash
# Suppression comment guard - blocks suppressions without justification
# Trigger: PreToolUse on Bash when command contains 'git commit'
# Exit codes: 0 = allow, 2 = block
#
# Requires suppressions to include a justification:
#   // @ts-expect-error TECH-DEBT: description or #123
#   // eslint-disable-next-line rule -- TECH-DEBT: reason
#   /* eslint-disable rule */ // TECH-DEBT: temporary for migration

# Read JSON input from stdin
INPUT=$(cat)

# Extract command from JSON
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only run for git commit commands
[[ "$COMMAND" != *"git commit"* ]] && exit 0

# Skip if --no-verify flag is present
[[ "$COMMAND" == *"--no-verify"* ]] && exit 0

# Get staged TS/TSX files (excluding tests - they have relaxed rules)
# Use NUL-delimited output for safe handling of filenames with spaces
TS_FILES=()
while IFS= read -r -d '' file; do
  [[ "$file" =~ \.(ts|tsx)$ ]] || continue
  [[ "$file" =~ \.test\. ]] && continue
  TS_FILES+=("$file")
done < <(git diff --cached --name-only -z --diff-filter=d 2>/dev/null)

# No staged files - allow
[[ ${#TS_FILES[@]} -eq 0 ]] && exit 0

ISSUES=""

# Pattern for valid justifications (case-insensitive)
# Accepts: TECH-DEBT:, #123, GH-123, github.com/issues/, TODO(name):, -- explanation
VALID_JUSTIFICATION='TECH-DEBT:|#[0-9]+|GH-[0-9]+|github\.com.*issues/[0-9]+|TODO\([^)]+\):|--\s+\w'

for file in "${TS_FILES[@]}"; do
  [[ ! -f "$file" ]] && continue

  # Get only added lines from staged changes
  ADDED_LINES=$(git diff --cached "$file" 2>/dev/null | grep '^+' | grep -v '^+++')

  # Check for @ts-ignore (should use @ts-expect-error instead)
  TS_IGNORE=$(echo "$ADDED_LINES" | grep '@ts-ignore' || true)
  if [[ -n "$TS_IGNORE" ]]; then
    ISSUES+="  $file: Use @ts-expect-error instead of @ts-ignore\n"
    ISSUES+="    Offending lines:\n$(echo "$TS_IGNORE" | sed 's/^/      /')\n"
  fi

  # Check for @ts-expect-error without justification
  TS_EXPECT=$(echo "$ADDED_LINES" | grep '@ts-expect-error' | grep -viE "$VALID_JUSTIFICATION" || true)
  if [[ -n "$TS_EXPECT" ]]; then
    ISSUES+="  $file: @ts-expect-error without justification\n"
    ISSUES+="    Offending lines:\n$(echo "$TS_EXPECT" | sed 's/^/      /')\n"
    ISSUES+="    Add: // @ts-expect-error TECH-DEBT: reason or #issue\n"
  fi

  # Check for eslint-disable without justification
  ESLINT_DISABLE=$(echo "$ADDED_LINES" | grep -E 'eslint-disable|eslint-disable-next-line|eslint-disable-line' | grep -viE "$VALID_JUSTIFICATION" || true)
  if [[ -n "$ESLINT_DISABLE" ]]; then
    ISSUES+="  $file: eslint-disable without justification\n"
    ISSUES+="    Offending lines:\n$(echo "$ESLINT_DISABLE" | sed 's/^/      /')\n"
    ISSUES+="    Add: // eslint-disable-next-line rule -- TECH-DEBT: reason\n"
  fi

  # Check for @ts-nocheck (almost never acceptable)
  TS_NOCHECK=$(echo "$ADDED_LINES" | grep '@ts-nocheck' || true)
  if [[ -n "$TS_NOCHECK" ]]; then
    ISSUES+="  $file: @ts-nocheck is not allowed (disables all type checking)\n"
  fi

done

if [[ -n "$ISSUES" ]]; then
  echo ""
  echo "Suppression comments require justification:"
  echo "---------------------------------------------"
  printf '%b' "$ISSUES"
  echo "---------------------------------------------"
  echo "Valid formats:"
  echo "  // @ts-expect-error TECH-DEBT: description"
  echo "  // @ts-expect-error #123"
  echo "  // eslint-disable-next-line rule -- explanation"
  echo "  // eslint-disable-next-line rule -- TECH-DEBT: reason"
  echo ""
  echo "Use --no-verify to skip (not recommended)"
  exit 2  # Block the commit
fi

exit 0
