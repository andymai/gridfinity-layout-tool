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
  # Uses the full staged file to check surrounding lines (role is often on an adjacent line)
  if echo "$STAGED_CONTENT" | grep -q 'tabIndex.*0'; then
    FULL_STAGED=$(git show ":$file" 2>/dev/null)
    if [[ -n "$FULL_STAGED" ]]; then
      # Find tabIndex={0} lines and check if the element has a role within 15 lines above
      HAS_ORPHAN=false
      while IFS= read -r line_num; do
        # Get 15 lines before through the tabIndex line from the staged file
        CONTEXT=$(echo "$FULL_STAGED" | sed -n "$((line_num > 15 ? line_num - 15 : 1)),${line_num}p")
        if ! echo "$CONTEXT" | grep -qE 'role=|role:'; then
          if ! echo "$CONTEXT" | grep -qE '<(button|a|input|select|textarea|summary)'; then
            HAS_ORPHAN=true
            break
          fi
        fi
      done < <(echo "$FULL_STAGED" | grep -n 'tabIndex.*0' | grep -v 'tabIndex={-1}' | cut -d: -f1)
      if $HAS_ORPHAN; then
        ISSUES+="  $file: tabIndex without role on non-interactive element\n"
      fi
    fi
  fi

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
  echo "" >&2
  echo "⚠️  Accessibility issues detected in staged files:" >&2
  echo "─────────────────────────────────────────────────" >&2
  echo -e "$ISSUES" >&2
  echo "─────────────────────────────────────────────────" >&2
  echo "Fix these issues or use --no-verify to skip (not recommended)" >&2
  exit 2  # Block the commit
fi

exit 0
