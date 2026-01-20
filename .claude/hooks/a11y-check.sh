#!/bin/bash
# Accessibility check hook - blocks commits with a11y issues
# Trigger: PreToolUse on Bash when command contains 'git commit'
# Exit codes: 0 = allow, 2 = block

# Read JSON input from stdin
INPUT=$(cat)

# Extract command from JSON
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only run for git commit commands
[[ "$COMMAND" != *"git commit"* ]] && exit 0

# Skip if --no-verify flag is present
[[ "$COMMAND" == *"--no-verify"* ]] && exit 0

# Get staged TSX files (excluding tests)
STAGED=$(git diff --cached --name-only --diff-filter=d 2>/dev/null | grep '\.tsx$' | grep -v '\.test\.')

# No staged TSX files - allow
[[ -z "$STAGED" ]] && exit 0

ISSUES=""

for file in $STAGED; do
  [[ ! -f "$file" ]] && continue

  # Get only the staged changes for this file
  STAGED_CONTENT=$(git diff --cached "$file" 2>/dev/null | grep '^+' | grep -v '^+++')

  # Check: tabIndex={0} without role= on non-interactive elements
  while IFS= read -r line; do
    if echo "$line" | grep -q 'tabIndex.*0' && ! echo "$line" | grep -q 'role='; then
      if ! echo "$line" | grep -qE '<(button|a|input|select|textarea|summary)'; then
        ISSUES+="  $file: tabIndex without role on non-interactive element\n"
        break
      fi
    fi
  done <<< "$STAGED_CONTENT"

  # Check: onClick on div/span without role or tabIndex
  while IFS= read -r line; do
    if echo "$line" | grep -qE '<(div|span)[^>]*onClick' && ! echo "$line" | grep -qE 'role=|tabIndex'; then
      ISSUES+="  $file: onClick on div/span without role or tabIndex\n"
      break
    fi
  done <<< "$STAGED_CONTENT"

  # Check: Empty aria-label
  if echo "$STAGED_CONTENT" | grep -q 'aria-label=""'; then
    ISSUES+="  $file: empty aria-label attribute\n"
  fi

  # Check: Image without alt attribute
  while IFS= read -r line; do
    if echo "$line" | grep -qE '<img[^>]*>' && ! echo "$line" | grep -q 'alt='; then
      ISSUES+="  $file: img without alt attribute\n"
      break
    fi
  done <<< "$STAGED_CONTENT"

  # Check: Self-closing button without aria-label
  while IFS= read -r line; do
    if echo "$line" | grep -qE '<button[^>]*/>' && ! echo "$line" | grep -q 'aria-label='; then
      ISSUES+="  $file: self-closing button without aria-label\n"
      break
    fi
  done <<< "$STAGED_CONTENT"
done

if [[ -n "$ISSUES" ]]; then
  echo ""
  echo "⚠️  Accessibility issues detected in staged files:"
  echo "─────────────────────────────────────────────────"
  echo -e "$ISSUES"
  echo "─────────────────────────────────────────────────"
  echo "Fix these issues or use --no-verify to skip (not recommended)"
  exit 2  # Block the commit
fi

exit 0
