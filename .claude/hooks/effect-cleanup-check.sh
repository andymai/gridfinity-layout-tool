#!/bin/bash
# useEffect cleanup validator - warns about effects missing cleanup
# Trigger: PostToolUse on Edit|Write for src/**/*.{ts,tsx}
# Exit codes: 0 = allow (informational only)
#
# Detects:
# - setTimeout/setInterval in useEffect without clearTimeout/clearInterval
# - addEventListener without removeEventListener
# - .subscribe() without .unsubscribe() or cleanup
# - Refs used for timers without cleanup

# Read JSON input from stdin
INPUT=$(cat)

# Extract file path from JSON
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

# Skip if no file provided
[[ -z "$FILE" ]] && exit 0

# Skip non-src files
[[ "$FILE" != */src/* && "$FILE" != src/* ]] && exit 0

# Skip test files
[[ "$FILE" == *.test.* ]] && exit 0

# Skip non-TS/TSX files (must be TSX for hooks, or TS for custom hooks)
[[ "$FILE" != *.ts && "$FILE" != *.tsx ]] && exit 0

# Skip if file doesn't exist
[[ ! -f "$FILE" ]] && exit 0

# Get file content
CONTENT=$(cat "$FILE")

# Skip if file doesn't use useEffect
if ! echo "$CONTENT" | grep -q 'useEffect'; then
  exit 0
fi

WARNINGS=""

# Extract useEffect blocks - this is approximate but catches common patterns
# We look for useEffect( followed by content until the dependency array

# Pattern 1: setTimeout without clearTimeout in useEffect
# Look for useEffect blocks containing setTimeout
if echo "$CONTENT" | grep -q 'useEffect' && echo "$CONTENT" | grep -qE 'setTimeout\s*\('; then
  # Check if there's a corresponding clearTimeout
  # Only count actual function calls, not type annotations like ReturnType<typeof setTimeout>
  TIMEOUT_COUNT=$(echo "$CONTENT" | grep -cE 'setTimeout\s*\(')
  CLEAR_COUNT=$(echo "$CONTENT" | grep -cE 'clearTimeout\s*\(')

  if [[ $TIMEOUT_COUNT -gt $CLEAR_COUNT ]]; then
    # More specific check: find setTimeout in useEffect without cleanup
    # Look for patterns like: setTimeout(() => { ... }, delay) without clearTimeout in return
    EFFECT_BLOCKS=$(echo "$CONTENT" | grep -A30 'useEffect\s*(' | grep -B5 -A10 'setTimeout')

    if [[ -n "$EFFECT_BLOCKS" ]] && ! echo "$EFFECT_BLOCKS" | grep -q 'clearTimeout'; then
      WARNINGS+="  setTimeout in useEffect without clearTimeout cleanup\n"
      WARNINGS+="    Store timeout ID and clear in cleanup: return () => clearTimeout(id)\n"
    fi
  fi
fi

# Pattern 2: setInterval without clearInterval
if echo "$CONTENT" | grep -q 'useEffect' && echo "$CONTENT" | grep -qE 'setInterval\s*\('; then
  INTERVAL_COUNT=$(echo "$CONTENT" | grep -cE 'setInterval\s*\(')
  CLEAR_INTERVAL_COUNT=$(echo "$CONTENT" | grep -cE 'clearInterval\s*\(')

  if [[ $INTERVAL_COUNT -gt $CLEAR_INTERVAL_COUNT ]]; then
    EFFECT_BLOCKS=$(echo "$CONTENT" | grep -A30 'useEffect\s*(' | grep -B5 -A10 'setInterval')

    if [[ -n "$EFFECT_BLOCKS" ]] && ! echo "$EFFECT_BLOCKS" | grep -q 'clearInterval'; then
      WARNINGS+="  setInterval in useEffect without clearInterval cleanup\n"
      WARNINGS+="    Store interval ID and clear in cleanup: return () => clearInterval(id)\n"
    fi
  fi
fi

# Pattern 3: addEventListener without removeEventListener
if echo "$CONTENT" | grep -q 'useEffect' && echo "$CONTENT" | grep -q 'addEventListener'; then
  ADD_COUNT=$(echo "$CONTENT" | grep -c 'addEventListener')
  REMOVE_COUNT=$(echo "$CONTENT" | grep -c 'removeEventListener')

  if [[ $ADD_COUNT -gt $REMOVE_COUNT ]]; then
    WARNINGS+="  addEventListener without matching removeEventListener\n"
    WARNINGS+="    Clean up listeners: return () => element.removeEventListener(...)\n"
  fi
fi

# Pattern 4: .subscribe() without cleanup (common in observables/stores)
if echo "$CONTENT" | grep -q 'useEffect' && echo "$CONTENT" | grep -qE '\.subscribe\s*\('; then
  # Check for unsubscribe pattern
  if ! echo "$CONTENT" | grep -qE '\.unsubscribe\s*\(|unsubscribe\s*\(\)|subscription\.'; then
    # Also check for return () => sub() pattern (Zustand subscribe returns unsubscribe)
    EFFECT_WITH_SUB=$(echo "$CONTENT" | grep -A20 'useEffect\s*(' | grep -B3 -A10 '\.subscribe')

    if [[ -n "$EFFECT_WITH_SUB" ]]; then
      # Check if the subscribe result is returned in cleanup
      if ! echo "$EFFECT_WITH_SUB" | grep -qE 'return.*subscribe|return\s*\(\)\s*=>\s*\{?\s*unsub'; then
        WARNINGS+="  .subscribe() in useEffect may need cleanup\n"
        WARNINGS+="    Zustand: const unsub = store.subscribe(...); return unsub;\n"
        WARNINGS+="    RxJS: return () => subscription.unsubscribe();\n"
      fi
    fi
  fi
fi

# Pattern 5: requestAnimationFrame without cancelAnimationFrame
if echo "$CONTENT" | grep -q 'useEffect' && echo "$CONTENT" | grep -qE 'requestAnimationFrame\s*\('; then
  RAF_COUNT=$(echo "$CONTENT" | grep -cE 'requestAnimationFrame\s*\(')
  CANCEL_COUNT=$(echo "$CONTENT" | grep -cE 'cancelAnimationFrame\s*\(')

  if [[ $RAF_COUNT -gt $CANCEL_COUNT ]]; then
    WARNINGS+="  requestAnimationFrame without cancelAnimationFrame cleanup\n"
    WARNINGS+="    Store RAF ID and cancel: return () => cancelAnimationFrame(id)\n"
  fi
fi

# Pattern 6: AbortController without abort() in cleanup
if echo "$CONTENT" | grep -q 'useEffect' && echo "$CONTENT" | grep -q 'AbortController'; then
  if ! echo "$CONTENT" | grep -qE '\.abort\s*\(\s*\)'; then
    EFFECT_WITH_ABORT=$(echo "$CONTENT" | grep -A20 'useEffect\s*(' | grep -B3 -A10 'AbortController')

    if [[ -n "$EFFECT_WITH_ABORT" ]] && ! echo "$EFFECT_WITH_ABORT" | grep -q '\.abort'; then
      WARNINGS+="  AbortController without abort() in cleanup\n"
      WARNINGS+="    Cancel pending requests: return () => controller.abort();\n"
    fi
  fi
fi

# Pattern 7: Timeout stored in ref without cleanup
if echo "$CONTENT" | grep -qE 'Ref.*setTimeout|timeoutRef|timerRef'; then
  if echo "$CONTENT" | grep -q 'useEffect'; then
    # Check if there's a cleanup that clears the ref
    TIMEOUT_REF=$(echo "$CONTENT" | grep -oE '[a-zA-Z]+Ref' | grep -iE 'timeout|timer' | head -1)

    if [[ -n "$TIMEOUT_REF" ]]; then
      # Check for cleanup pattern
      if ! echo "$CONTENT" | grep -qE "clearTimeout\s*\(\s*${TIMEOUT_REF}"; then
        WARNINGS+="  Timer ref ($TIMEOUT_REF) may need cleanup in useEffect\n"
        WARNINGS+="    return () => { if (${TIMEOUT_REF}.current) clearTimeout(${TIMEOUT_REF}.current); }\n"
      fi
    fi
  fi
fi

if [[ -n "$WARNINGS" ]]; then
  echo ""
  echo "useEffect cleanup warnings:"
  echo "---------------------------------------------"
  echo -e "$WARNINGS"
  echo "---------------------------------------------"
  echo "Effects that set up subscriptions/timers should clean up:"
  echo ""
  echo "  useEffect(() => {"
  echo "    const id = setTimeout(fn, delay);"
  echo "    return () => clearTimeout(id);  // Cleanup!"
  echo "  }, [deps]);"
  echo ""
fi

# Informational only - always allow
exit 0
