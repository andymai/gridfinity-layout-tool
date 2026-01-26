#!/bin/bash
# Discriminated union exhaustiveness check - blocks commits with unhandled cases
# Trigger: PreToolUse on Bash when command contains 'git commit'
# Exit codes: 0 = allow, 2 = block
#
# Detects switch/if-else on union types that don't handle all cases:
# - ValidationReason: out_of_bounds, exceeds_width, exceeds_depth, exceeds_height, invalid_layer, collision, blocked_zone
# - InteractionMode: draw, drag, resize, stagingDrag, paint
# - ToastType: success, error, info
# - LayerViewMode: focus, stack, all
# - EditSource: local, remote, init, null

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

# Define known union types and their members
# Format: "TypeName:member1,member2,member3"
declare -A UNION_TYPES=(
  ["ValidationReason"]="out_of_bounds,exceeds_width,exceeds_depth,exceeds_height,invalid_layer,collision,blocked_zone"
  ["ToastType"]="success,error,info"
  ["LayerViewMode"]="focus,stack,all"
  ["DropTarget"]="trash,staging"
  ["EditSource"]="local,remote,init"
  ["MobileLayersTab"]="layers,tools"
)

for file in "${TS_FILES[@]}"; do
  [[ ! -f "$file" ]] && continue

  # Get the full file content for analysis
  CONTENT=$(cat "$file")

  # Get only added lines from staged changes
  ADDED_LINES=$(git diff --cached "$file" 2>/dev/null | grep '^+' | grep -v '^+++')

  [[ -z "$ADDED_LINES" ]] && continue

  # Check if file uses any of our tracked union types
  for TYPE_NAME in "${!UNION_TYPES[@]}"; do
    # Skip if this type isn't used in the file
    if ! echo "$CONTENT" | grep -q "$TYPE_NAME"; then
      continue
    fi

    MEMBERS="${UNION_TYPES[$TYPE_NAME]}"
    IFS=',' read -ra MEMBER_ARRAY <<< "$MEMBERS"

    # Look for switch statements in added code that might be on this type
    # We detect: switch (variable) { case 'member1': ... }
    # where member1 is one of our union members

    # Find switch statements in added lines
    SWITCH_BLOCKS=$(echo "$ADDED_LINES" | grep -n 'switch\s*(' | head -10)

    while IFS= read -r switch_line; do
      [[ -z "$switch_line" ]] && continue

      # Get line number in diff
      LINE_NUM=$(echo "$switch_line" | cut -d: -f1)

      # Get context around the switch (next 50 lines should cover most switches)
      SWITCH_CONTEXT=$(echo "$ADDED_LINES" | tail -n +"$LINE_NUM" | head -60)

      # Check if this switch uses any of our union members
      USES_TYPE=false
      for member in "${MEMBER_ARRAY[@]}"; do
        if echo "$SWITCH_CONTEXT" | grep -qE "case\s*['\"]${member}['\"]"; then
          USES_TYPE=true
          break
        fi
      done

      if [[ "$USES_TYPE" == "true" ]]; then
        # This switch is on our union type - check for missing cases
        MISSING_CASES=""

        for member in "${MEMBER_ARRAY[@]}"; do
          if ! echo "$SWITCH_CONTEXT" | grep -qE "case\s*['\"]${member}['\"]"; then
            MISSING_CASES+="$member, "
          fi
        done

        # Check if there's a default case (which is acceptable)
        HAS_DEFAULT=false
        if echo "$SWITCH_CONTEXT" | grep -qE '^\+\s*default\s*:'; then
          HAS_DEFAULT=true
        fi

        # Check for exhaustive check pattern (assertNever or throw with "exhaustive")
        HAS_EXHAUSTIVE=false
        if echo "$SWITCH_CONTEXT" | grep -qiE 'assertNever|exhaustive|never'; then
          HAS_EXHAUSTIVE=true
        fi

        if [[ -n "$MISSING_CASES" ]] && [[ "$HAS_DEFAULT" == "false" ]] && [[ "$HAS_EXHAUSTIVE" == "false" ]]; then
          MISSING_CASES="${MISSING_CASES%, }"  # Remove trailing comma
          ISSUES+="  $file: switch on $TYPE_NAME missing cases: $MISSING_CASES\n"
          ISSUES+="    Add missing cases or a default with exhaustive check\n"
        fi
      fi
    done <<< "$SWITCH_BLOCKS"

    # Also check for if/else chains on these types
    # Pattern: if (x === 'member1') ... else if (x === 'member2')
    IF_CHAINS=$(echo "$ADDED_LINES" | grep -n "===\s*['\"]" | head -20)

    # Group consecutive if/else if statements that check the same variable
    PREV_VAR=""
    CHAIN_MEMBERS=()
    CHAIN_START_LINE=""

    while IFS= read -r if_line; do
      [[ -z "$if_line" ]] && continue

      # Extract the variable and value being checked
      VAR=$(echo "$if_line" | grep -oE '\w+\s*===\s*' | sed 's/\s*===\s*//')
      VALUE=$(echo "$if_line" | grep -oE "===\s*['\"][^'\"]+['\"]" | sed "s/===\s*['\"]//;s/['\"]//")

      # Check if this value is one of our union members
      IS_UNION_MEMBER=false
      for member in "${MEMBER_ARRAY[@]}"; do
        if [[ "$VALUE" == "$member" ]]; then
          IS_UNION_MEMBER=true
          break
        fi
      done

      if [[ "$IS_UNION_MEMBER" == "true" ]]; then
        if [[ "$VAR" == "$PREV_VAR" ]] || [[ -z "$PREV_VAR" ]]; then
          CHAIN_MEMBERS+=("$VALUE")
          [[ -z "$CHAIN_START_LINE" ]] && CHAIN_START_LINE=$(echo "$if_line" | cut -d: -f1)
        else
          # New variable - check previous chain if it had members
          if [[ ${#CHAIN_MEMBERS[@]} -ge 2 ]]; then
            MISSING=""
            for member in "${MEMBER_ARRAY[@]}"; do
              FOUND=false
              for cm in "${CHAIN_MEMBERS[@]}"; do
                [[ "$cm" == "$member" ]] && FOUND=true && break
              done
              [[ "$FOUND" == "false" ]] && MISSING+="$member, "
            done
            if [[ -n "$MISSING" ]]; then
              MISSING="${MISSING%, }"
              ISSUES+="  $file: if/else chain on $TYPE_NAME missing: $MISSING\n"
            fi
          fi
          CHAIN_MEMBERS=("$VALUE")
          CHAIN_START_LINE=$(echo "$if_line" | cut -d: -f1)
        fi
        PREV_VAR="$VAR"
      fi
    done <<< "$IF_CHAINS"
  done
done

if [[ -n "$ISSUES" ]]; then
  echo ""
  echo "Union type exhaustiveness issues:"
  echo "---------------------------------------------"
  printf '%b' "$ISSUES"
  echo "---------------------------------------------"
  echo "Switch statements on union types should handle all cases."
  echo ""
  echo "Options:"
  echo "  1. Add missing case statements"
  echo "  2. Add default with exhaustive check:"
  echo "     default:"
  echo "       const _exhaustive: never = value;"
  echo "       throw new Error('Unhandled case');"
  echo ""
  echo "Use --no-verify to skip (not recommended)"
  exit 2
fi

exit 0
