#!/bin/bash
# Dangerous pattern detector - catches patterns that cause runtime issues
# Trigger: PreToolUse on Bash when command contains 'git commit'
# Exit codes: 0 = allow, 2 = block
#
# Detects:
#   - JSON.parse without try-catch
#   - localStorage/sessionStorage without error handling
#   - .innerHTML = (XSS risk)
#   - eval() usage
#   - document.write

# Read JSON input from stdin
INPUT=$(cat)

# Extract command from JSON
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only run for git commit commands
[[ "$COMMAND" != *"git commit"* ]] && exit 0

# Skip if --no-verify flag is present
[[ "$COMMAND" == *"--no-verify"* ]] && exit 0

# Get staged TS/TSX files (excluding tests), safely handling spaces
TS_FILES=()
while IFS= read -r -d '' file; do
  [[ "$file" =~ \.(ts|tsx)$ ]] || continue
  [[ "$file" =~ \.test\. ]] && continue
  TS_FILES+=("$file")
done < <(git diff --cached --name-only -z --diff-filter=d 2>/dev/null)

# No staged files - allow
[[ ${#TS_FILES[@]} -eq 0 ]] && exit 0

ISSUES=""

for file in "${TS_FILES[@]}"; do
  [[ ! -f "$file" ]] && continue

  # Get only added lines from staged changes (with line content)
  ADDED_LINES=$(git diff --cached "$file" 2>/dev/null | grep '^+' | grep -v '^+++')

  # Skip if no additions
  [[ -z "$ADDED_LINES" ]] && continue

  # Get the actual diff with context once per file (for checks that need it)
  DIFF_CONTEXT=$(git diff --cached -U30 "$file" 2>/dev/null)

  # Check 1: innerHTML assignment (XSS risk)
  if echo "$ADDED_LINES" | grep -qE '\.innerHTML\s*='; then
    # Allow if it's a sanitized value or explicit empty string assignment
    UNSAFE_LINES=$(echo "$ADDED_LINES" | grep -E '\.innerHTML\s*=' 2>/dev/null || true)
    UNSAFE=$(echo "$UNSAFE_LINES" | grep -vE '\.innerHTML\s*=\s*["'\'']\s*["'\'']\s*;?\s*$|sanitize|DOMPurify' 2>/dev/null || true)
    if [[ -n "$UNSAFE" ]]; then
      ISSUES+="  $file: .innerHTML assignment (XSS risk)\n"
      ISSUES+="    Use textContent or sanitize input\n"
    fi
  fi

  # Check 2: eval() usage
  if echo "$ADDED_LINES" | grep -qE '\beval\s*\('; then
    ISSUES+="  $file: eval() usage (code injection risk)\n"
    ISSUES+="    Avoid eval - use safer alternatives\n"
  fi

  # Check 3: document.write
  if echo "$ADDED_LINES" | grep -qE 'document\.write\s*\('; then
    ISSUES+="  $file: document.write (blocks parsing, security risk)\n"
  fi

  # Check 4: new Function() constructor (similar to eval)
  if echo "$ADDED_LINES" | grep -qE 'new\s+Function\s*\('; then
    ISSUES+="  $file: new Function() (code injection risk)\n"
  fi

  # Check 5: Unguarded JSON.parse
  # Look for JSON.parse not inside a try block or without catch nearby
  if echo "$ADDED_LINES" | grep -qE 'JSON\.parse\s*\('; then
    # Find all JSON.parse occurrences and check each one
    while IFS= read -r match_line; do
      [[ -z "$match_line" ]] && continue
      LINE_NUM=$(echo "$match_line" | cut -d: -f1)

      # Skip if line is in a comment
      LINE_CONTENT=$(echo "$DIFF_CONTEXT" | sed -n "${LINE_NUM}p")
      [[ "$LINE_CONTENT" == *"//"*"JSON.parse"* ]] && continue

      # Get surrounding context
      CONTEXT_START=$((LINE_NUM > 10 ? LINE_NUM - 10 : 1))
      CONTEXT_END=$((LINE_NUM + 5))
      CONTEXT=$(echo "$DIFF_CONTEXT" | sed -n "${CONTEXT_START},${CONTEXT_END}p")

      if ! echo "$CONTEXT" | grep -qE 'try\s*\{|\.catch\(|catch\s*\('; then
        ISSUES+="  $file: JSON.parse without try-catch\n"
        ISSUES+="    Wrap in try-catch or use a safe parser\n"
        break  # Only report once per file
      fi
    done < <(echo "$DIFF_CONTEXT" | grep -n 'JSON\.parse' | grep '^[0-9]*:+')
  fi

  # Check 6: Unguarded localStorage/sessionStorage in non-utility files
  # Storage can throw in private browsing, when full, or when disabled
  if echo "$ADDED_LINES" | grep -qE '(localStorage|sessionStorage)\.(get|set|remove)Item'; then
    # Skip if file is in storage/ directory (assumed to have proper handling)
    if [[ "$file" != */storage/* ]]; then
      # Check each storage access for try-catch
      while IFS= read -r match_line; do
        [[ -z "$match_line" ]] && continue
        LINE_NUM=$(echo "$match_line" | cut -d: -f1)

        # Get surrounding context for this specific line
        CONTEXT_START=$((LINE_NUM > 10 ? LINE_NUM - 10 : 1))
        CONTEXT_END=$((LINE_NUM + 5))
        CONTEXT=$(echo "$DIFF_CONTEXT" | sed -n "${CONTEXT_START},${CONTEXT_END}p")

        if ! echo "$CONTEXT" | grep -qE 'try\s*\{|\.catch\(|catch\s*\('; then
          ISSUES+="  $file: localStorage/sessionStorage without error handling\n"
          ISSUES+="    Use core/storage layer or wrap in try-catch\n"
          break  # Only report once per file
        fi
      done < <(echo "$DIFF_CONTEXT" | grep -n -E '(localStorage|sessionStorage)\.(get|set|remove)Item' | grep '^[0-9]*:+')
    fi
  fi

  # Check 7: Hardcoded API keys or secrets patterns
  # Only match actual assignment with quoted string values of significant length
  if echo "$ADDED_LINES" | grep -qiE "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][a-zA-Z0-9+/=_-]{32,}['\"]"; then
    ISSUES+="  $file: Possible hardcoded secret detected\n"
    ISSUES+="    Use environment variables instead\n"
  fi

  # Check 8: Synchronous XHR (blocks main thread)
  if echo "$ADDED_LINES" | grep -qE '\.open\s*\([^,]+,\s*[^,]+,\s*false\s*\)'; then
    ISSUES+="  $file: Synchronous XHR (blocks main thread)\n"
    ISSUES+="    Use async: true or fetch API\n"
  fi

done

if [[ -n "$ISSUES" ]]; then
  echo "" >&2
  echo "Dangerous patterns detected:" >&2
  echo "---------------------------------------------" >&2
  printf '%b' "$ISSUES" >&2
  echo "---------------------------------------------" >&2
  echo "Fix these issues or use --no-verify to skip (not recommended)" >&2
  exit 2  # Block the commit
fi

exit 0
