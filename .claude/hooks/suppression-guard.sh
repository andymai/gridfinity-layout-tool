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
STAGED=$(git diff --cached --name-only --diff-filter=d 2>/dev/null | grep -E '\.(ts|tsx)$' | grep -v '\.test\.')

# No staged files - allow
[[ -z "$STAGED" ]] && exit 0

ISSUES=""

# Pattern for valid justifications (case-insensitive)
# Accepts: TECH-DEBT:, #123, GH-123, github.com/issues/, TODO(name):, -- explanation
VALID_JUSTIFICATION='TECH-DEBT:|#[0-9]+|GH-[0-9]+|github\.com.*issues/[0-9]+|TODO\([^)]+\):|--\s+\w'

for file in $STAGED; do
  [[ ! -f "$file" ]] && continue

  # Get only added lines from staged changes
  ADDED_LINES=$(git diff --cached "$file" 2>/dev/null | grep '^+' | grep -v '^+++')

  # Check for @ts-ignore (should use @ts-expect-error instead)
  if echo "$ADDED_LINES" | grep -q '@ts-ignore'; then
    ISSUES+="  $file: Use @ts-expect-error instead of @ts-ignore\n"
  fi

  # Check for @ts-expect-error without justification
  TS_EXPECT=$(echo "$ADDED_LINES" | grep '@ts-expect-error' | grep -viE "$VALID_JUSTIFICATION")
  if [[ -n "$TS_EXPECT" ]]; then
    ISSUES+="  $file: @ts-expect-error without justification\n"
    ISSUES+="    Add: // @ts-expect-error TECH-DEBT: reason or #issue\n"
  fi

  # Check for eslint-disable without justification
  ESLINT_DISABLE=$(echo "$ADDED_LINES" | grep -E 'eslint-disable|eslint-disable-next-line|eslint-disable-line' | grep -viE "$VALID_JUSTIFICATION")
  if [[ -n "$ESLINT_DISABLE" ]]; then
    ISSUES+="  $file: eslint-disable without justification\n"
    ISSUES+="    Add: // eslint-disable-next-line rule -- TECH-DEBT: reason\n"
  fi

  # Check for @ts-nocheck (almost never acceptable)
  if echo "$ADDED_LINES" | grep -q '@ts-nocheck'; then
    ISSUES+="  $file: @ts-nocheck is not allowed (disables all type checking)\n"
  fi

done

if [[ -n "$ISSUES" ]]; then
  echo ""
  echo "🚫 Suppression comments require justification:"
  echo "─────────────────────────────────────────────────"
  echo -e "$ISSUES"
  echo "─────────────────────────────────────────────────"
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
