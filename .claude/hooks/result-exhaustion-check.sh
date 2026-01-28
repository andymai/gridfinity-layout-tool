#!/bin/bash
# Result type exhaustion check - blocks commits with unchecked Result values
# Trigger: PreToolUse on Bash when command contains 'git commit'
# Exit codes: 0 = allow, 2 = block
#
# Detects:
# - Result<T,E> return values assigned but never checked with isOk/isErr
# - Bulk operations that loop and ignore individual failures

# Read JSON input from stdin
INPUT=$(cat)

# Extract command from JSON
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only run for git commit commands
[[ "$COMMAND" != *"git commit"* ]] && exit 0

# Skip if --no-verify flag is present
[[ "$COMMAND" == *"--no-verify"* ]] && exit 0

# Get staged TS/TSX files (excluding tests)
TS_FILES=()
while IFS= read -r -d '' file; do
  [[ "$file" =~ \.(ts|tsx)$ ]] || continue
  [[ "$file" =~ \.test\. ]] && continue
  [[ "$file" =~ /test/ ]] && continue
  TS_FILES+=("$file")
done < <(git diff --cached --name-only -z --diff-filter=d 2>/dev/null)

# No staged files - allow
[[ ${#TS_FILES[@]} -eq 0 ]] && exit 0

ISSUES=""

# Functions that return Result types (from src/core/store/layout.ts and others)
RESULT_FUNCTIONS="addBin|updateBin|deleteBin|duplicateBin|moveBin|resizeBin|setBinLayer|setBinCategory|addLayer|deleteLayer|updateLayer|reorderLayers|addCategory|deleteCategory|updateCategory|validateBin|validateLayout|getLayerZStart|saveLayout|loadLayout"

for file in "${TS_FILES[@]}"; do
  [[ ! -f "$file" ]] && continue

  # Get only added lines from staged changes
  ADDED_LINES=$(git diff --cached "$file" 2>/dev/null | grep '^+' | grep -v '^+++')

  [[ -z "$ADDED_LINES" ]] && continue

  # Pattern 1: Result-returning function called but result not stored or checked
  # e.g., addBin({ ... }); // Result ignored
  # This is tricky - look for function calls not assigned to anything
  IGNORED_RESULTS=$(echo "$ADDED_LINES" | grep -E "^\+\s*(${RESULT_FUNCTIONS})\s*\(" | grep -v '=' | grep -v 'isOk' | grep -v 'isErr' | head -3)

  if [[ -n "$IGNORED_RESULTS" ]]; then
    ISSUES+="  $file: Result-returning function called but result ignored\n"
    while IFS= read -r line; do
      ISSUES+="    ${line:0:70}\n"
    done <<< "$IGNORED_RESULTS"
  fi

  # Pattern 2: Result assigned but never checked
  # Look for: const result = addBin(...) without subsequent isOk/isErr
  # Get the full diff with context for better analysis
  DIFF_CONTENT=$(git diff --cached "$file" 2>/dev/null)

  # Find variable names assigned Result values in added lines
  RESULT_VARS=$(echo "$ADDED_LINES" | grep -oE "(const|let)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(${RESULT_FUNCTIONS})" | grep -oE '(const|let)\s+[a-zA-Z_][a-zA-Z0-9_]*' | awk '{print $2}')

  for var in $RESULT_VARS; do
    [[ -z "$var" ]] && continue

    # Check if this variable is used with isOk/isErr in the diff
    if ! echo "$DIFF_CONTENT" | grep -qE "(isOk|isErr)\s*\(\s*${var}\s*\)"; then
      # Also check for .match() or direct .value access with type guard
      if ! echo "$DIFF_CONTENT" | grep -qE "${var}\s*\.\s*(match|value)"; then
        ISSUES+="  $file: Result '$var' assigned but not checked with isOk/isErr\n"
      fi
    fi
  done

  # Pattern 3: Loop with Result-returning function that ignores errors
  # e.g., for (const id of ids) { addBin(...); } // All errors lost
  # Look for for/forEach loops containing Result functions without error accumulation
  LOOP_WITH_RESULT=$(echo "$ADDED_LINES" | grep -B2 -A2 -E "(for\s*\(|\.forEach\(|\.map\()" | grep -E "(${RESULT_FUNCTIONS})\s*\(" | head -2)

  if [[ -n "$LOOP_WITH_RESULT" ]]; then
    # Check if the loop accumulates errors or checks results
    LOOP_CONTEXT=$(echo "$DIFF_CONTENT" | grep -B5 -A5 -E "(for\s*\(|\.forEach\(|\.map\()" | grep -E "(${RESULT_FUNCTIONS})")

    if ! echo "$LOOP_CONTEXT" | grep -qE 'isOk|isErr|errors\.push|failed|results\.push'; then
      ISSUES+="  $file: Loop with Result-returning function may silently skip failures\n"
      ISSUES+="    Consider: accumulate errors or check each result\n"
    fi
  fi
done

if [[ -n "$ISSUES" ]]; then
  echo "" >&2
  echo "Result type exhaustion issues:" >&2
  echo "---------------------------------------------" >&2
  printf '%b' "$ISSUES" >&2
  echo "---------------------------------------------" >&2
  echo "Result<T,E> values must be checked with isOk()/isErr()" >&2
  echo "" >&2
  echo "Correct patterns:" >&2
  echo "  const result = addBin(...);" >&2
  echo "  if (isOk(result)) { /* use result.value */ }" >&2
  echo "  if (isErr(result)) { /* handle result.error */ }" >&2
  echo "" >&2
  echo "For bulk operations:" >&2
  echo "  const errors: Error[] = [];" >&2
  echo "  for (const item of items) {" >&2
  echo "    const result = process(item);" >&2
  echo "    if (isErr(result)) errors.push(result.error);" >&2
  echo "  }" >&2
  echo "" >&2
  echo "Use --no-verify to skip (not recommended)" >&2
  exit 2
fi

exit 0
