#!/bin/bash
# useShallow enforcement hook - warns when Zustand selectors should use useShallow
# Trigger: PostToolUse on Edit|Write for src/**/*.{ts,tsx}
# Exit codes: 0 = allow (informational only)
#
# Detects patterns that should use useShallow:
# - Multiple useXxxStore() calls selecting arrays/objects in same component
# - Destructuring multiple values from store without useShallow

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

# Skip non-TS/TSX files
[[ "$FILE" != *.ts && "$FILE" != *.tsx ]] && exit 0

# Skip if file doesn't exist
[[ ! -f "$FILE" ]] && exit 0

# Get file content
CONTENT=$(cat "$FILE")

# Skip if file doesn't use any stores
if ! echo "$CONTENT" | grep -qE 'use(Layout|Selection|Interaction|Settings|Library|History)Store'; then
  exit 0
fi

WARNINGS=""

# Pattern 1: Multiple store selector calls returning arrays
# e.g., const bins = useLayoutStore(state => state.layout.bins);
#       const layers = useLayoutStore(state => state.layout.layers);
STORE_SELECTORS=$(echo "$CONTENT" | grep -oE 'use[A-Z][a-zA-Z]+Store\s*\(\s*\(?\s*state\s*\)?\s*=>' | sort | uniq -c | sort -rn)

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  COUNT=$(echo "$line" | awk '{print $1}')
  STORE=$(echo "$line" | grep -oE 'use[A-Z][a-zA-Z]+Store')

  if [[ "$COUNT" -ge 3 ]]; then
    # Check if useShallow is already imported and used with this store
    if ! echo "$CONTENT" | grep -q "useShallow"; then
      WARNINGS+="  Multiple $STORE selectors ($COUNT calls) - consider useShallow\n"
    fi
  fi
done <<< "$STORE_SELECTORS"

# Pattern 2: Selector returning object/array properties without useShallow
# Look for selectors that access .bins, .layers, .categories, .selectedBinIds
ARRAY_SELECTORS=$(echo "$CONTENT" | grep -E 'use[A-Z][a-zA-Z]+Store\s*\(' | grep -E '\.(bins|layers|categories|selectedBinIds|layouts)\b' | head -5)

if [[ -n "$ARRAY_SELECTORS" ]] && ! echo "$CONTENT" | grep -q "useShallow"; then
  # Count how many array-returning selectors there are
  ARRAY_COUNT=$(echo "$ARRAY_SELECTORS" | wc -l)
  if [[ "$ARRAY_COUNT" -ge 2 ]]; then
    WARNINGS+="  Selecting arrays from store without useShallow (causes re-renders)\n"
    WARNINGS+="    Found: $(echo "$ARRAY_SELECTORS" | head -2 | tr '\n' ' ')\n"
  fi
fi

# Pattern 3: Destructuring multiple values in selector
# e.g., useLayoutStore(state => ({ bins: state.layout.bins, layers: state.layout.layers }))
DESTRUCTURE_SELECTOR=$(echo "$CONTENT" | grep -E 'use[A-Z][a-zA-Z]+Store\s*\(\s*\(?\s*state\s*\)?\s*=>\s*\(\{' | head -3)

if [[ -n "$DESTRUCTURE_SELECTOR" ]] && ! echo "$CONTENT" | grep -q "useShallow"; then
  WARNINGS+="  Object selector without useShallow (new object every render)\n"
  WARNINGS+="    Wrap with: useXxxStore(useShallow(state => ({ ... })))\n"
fi

if [[ -n "$WARNINGS" ]]; then
  echo "" >&2
  echo "Zustand selector optimization (useShallow):" >&2
  echo "---------------------------------------------" >&2
  echo -e "$WARNINGS" >&2
  echo "---------------------------------------------" >&2
  echo "Import: import { useShallow } from 'zustand/react/shallow'" >&2
  echo "Usage:  useStore(useShallow(state => ({ a: state.a, b: state.b })))" >&2
  echo "" >&2
fi

# Informational only - always allow
exit 0
