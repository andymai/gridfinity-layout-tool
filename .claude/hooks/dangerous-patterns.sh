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

# Get staged TS/TSX files (excluding tests)
STAGED=$(git diff --cached --name-only --diff-filter=d 2>/dev/null | grep -E '\.(ts|tsx)$' | grep -v '\.test\.')

# No staged files - allow
[[ -z "$STAGED" ]] && exit 0

ISSUES=""

for file in $STAGED; do
  [[ ! -f "$file" ]] && continue

  # Get only added lines from staged changes (with line content)
  ADDED_LINES=$(git diff --cached "$file" 2>/dev/null | grep '^+' | grep -v '^+++')

  # Skip if no additions
  [[ -z "$ADDED_LINES" ]] && continue

  # Check 1: innerHTML assignment (XSS risk)
  if echo "$ADDED_LINES" | grep -qE '\.innerHTML\s*='; then
    # Allow if it's a sanitized value or empty string
    UNSAFE=$(echo "$ADDED_LINES" | grep -E '\.innerHTML\s*=' | grep -vE 'innerHTML\s*=\s*["'\'']\s*["'\'']|sanitize|DOMPurify')
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
    # Get the actual diff with context to check for try-catch
    DIFF_CONTEXT=$(git diff --cached -U10 "$file" 2>/dev/null)

    # Find JSON.parse lines and check if they're in try blocks
    while IFS= read -r line; do
      # Skip if line is in a comment
      [[ "$line" == *"//"*"JSON.parse"* ]] && continue

      # Check if there's a try block nearby (crude but effective)
      LINE_NUM=$(echo "$DIFF_CONTEXT" | grep -n "JSON\.parse" | head -1 | cut -d: -f1)
      if [[ -n "$LINE_NUM" ]]; then
        # Get surrounding context
        CONTEXT=$(echo "$DIFF_CONTEXT" | sed -n "$((LINE_NUM > 10 ? LINE_NUM - 10 : 1)),$((LINE_NUM + 5))p")
        if ! echo "$CONTEXT" | grep -qE 'try\s*\{|\.catch\(|catch\s*\('; then
          ISSUES+="  $file: JSON.parse without try-catch\n"
          ISSUES+="    Wrap in try-catch or use a safe parser\n"
          break
        fi
      fi
    done <<< "$(echo "$ADDED_LINES" | grep 'JSON\.parse')"
  fi

  # Check 6: Unguarded localStorage/sessionStorage in non-utility files
  # Storage can throw in private browsing, when full, or when disabled
  if echo "$ADDED_LINES" | grep -qE '(localStorage|sessionStorage)\.(get|set|remove)Item'; then
    # Skip if file is in storage/ directory (assumed to have proper handling)
    if [[ "$file" != *"/storage/"* ]]; then
      DIFF_CONTEXT=$(git diff --cached -U10 "$file" 2>/dev/null)
      if ! echo "$DIFF_CONTEXT" | grep -qE 'try\s*\{|\.catch\(|catch\s*\('; then
        ISSUES+="  $file: localStorage/sessionStorage without error handling\n"
        ISSUES+="    Use core/storage layer or wrap in try-catch\n"
      fi
    fi
  fi

  # Check 7: Hardcoded API keys or secrets patterns
  if echo "$ADDED_LINES" | grep -qiE '(api[_-]?key|secret|password|token)\s*[:=]\s*["\x27][a-zA-Z0-9_-]{20,}'; then
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
  echo ""
  echo "🚨 Dangerous patterns detected:"
  echo "─────────────────────────────────────────────────"
  echo -e "$ISSUES"
  echo "─────────────────────────────────────────────────"
  echo "Fix these issues or use --no-verify to skip (not recommended)"
  exit 2  # Block the commit
fi

exit 0
