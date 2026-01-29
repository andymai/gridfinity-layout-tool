#!/bin/bash
# Pre-PR review hook - runs checks before creating PR
# Trigger: PreToolUse on Bash when command contains 'gh pr create'
# Exit codes: 0 = allow (informational only)

# Read JSON input from stdin
INPUT=$(cat)

# Extract command from JSON
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only run for gh pr create commands
[[ "$COMMAND" != *"gh pr create"* ]] && exit 0

echo "" >&2
echo "🔍 Running pre-PR review..." >&2
echo "═══════════════════════════════════════════════════════════════" >&2

# Detect base branch
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
[[ -z "$BASE_BRANCH" ]] && BASE_BRANCH="main"

# Gather context
CURRENT_BRANCH=$(git branch --show-current)
FILES_CHANGED=$(git diff --name-only "$BASE_BRANCH"..."$CURRENT_BRANCH" 2>/dev/null | head -50)
COMMITS=$(git log --oneline "$BASE_BRANCH".."$CURRENT_BRANCH" 2>/dev/null | head -20)
STATS=$(git diff --stat "$BASE_BRANCH"..."$CURRENT_BRANCH" 2>/dev/null | tail -1)

# Count changes
NUM_FILES=$(echo "$FILES_CHANGED" | grep -c . || echo "0")
NUM_COMMITS=$(echo "$COMMITS" | grep -c . || echo "0")

echo "" >&2
echo "Branch: $CURRENT_BRANCH → $BASE_BRANCH" >&2
echo "Files changed: $NUM_FILES" >&2
echo "Commits: $NUM_COMMITS" >&2
echo "Stats: $STATS" >&2
echo "" >&2
echo "───────────────────────────────────────────────────────────────" >&2

ISSUES=""

# Check 1: Large PR warning
if [[ $NUM_FILES -gt 20 ]]; then
  ISSUES+="⚠️  Large PR ($NUM_FILES files) - consider splitting\n"
fi

# Check 2: Console.log in diff
CONSOLE_LOGS=$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- '*.ts' '*.tsx' 2>/dev/null | grep '^+' | grep -v '^+++' | grep 'console\.log' | head -3)
if [[ -n "$CONSOLE_LOGS" ]]; then
  ISSUES+="⚠️  console.log statements found:\n"
  while IFS= read -r line; do
    ISSUES+="    ${line:0:80}\n"
  done <<< "$CONSOLE_LOGS"
fi

# Check 3: TODO/FIXME comments added
TODOS=$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- '*.ts' '*.tsx' 2>/dev/null | grep '^+' | grep -v '^+++' | grep -iE 'TODO|FIXME|HACK|XXX' | head -3)
if [[ -n "$TODOS" ]]; then
  ISSUES+="📝 TODO/FIXME comments (ensure intentional):\n"
  while IFS= read -r line; do
    ISSUES+="    ${line:0:80}\n"
  done <<< "$TODOS"
fi

# Check 4: 'any' type usage
ANY_TYPES=$(git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- '*.ts' '*.tsx' 2>/dev/null | grep '^+' | grep -v '^+++' | grep -E ': any[^a-zA-Z]|<any>|as any' | head -3)
if [[ -n "$ANY_TYPES" ]]; then
  ISSUES+="⚠️  'any' type usage (use 'unknown' instead):\n"
  while IFS= read -r line; do
    ISSUES+="    ${line:0:80}\n"
  done <<< "$ANY_TYPES"
fi

# Check 5: Accessibility issues in changed TSX files
A11Y_ISSUES=""
for file in $FILES_CHANGED; do
  [[ "$file" != *.tsx ]] && continue
  [[ "$file" == *.test.* ]] && continue

  # tabIndex without role
  if git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- "$file" 2>/dev/null | grep '^+' | grep 'tabIndex' | grep -v 'role=' | grep -q .; then
    A11Y_ISSUES+="    $file: tabIndex without role\n"
  fi

  # onClick on div without role
  if git diff "$BASE_BRANCH"..."$CURRENT_BRANCH" -- "$file" 2>/dev/null | grep '^+' | grep -E '<div[^>]*onClick' | grep -v 'role=' | grep -q .; then
    A11Y_ISSUES+="    $file: onClick on div without role\n"
  fi
done
if [[ -n "$A11Y_ISSUES" ]]; then
  ISSUES+="♿ Accessibility concerns:\n$A11Y_ISSUES"
fi

# Check 7: New files without tests
NEW_SRC_FILES=$(git diff --name-only --diff-filter=A "$BASE_BRANCH"..."$CURRENT_BRANCH" 2>/dev/null | grep -E '^src/.*\.(ts|tsx)$' | grep -v '\.test\.' | grep -v 'index\.')
MISSING_TESTS=""
for file in $NEW_SRC_FILES; do
  BASENAME=$(basename "$file" .tsx)
  BASENAME=${BASENAME%.ts}

  # Check if any test file references this
  if ! git diff --name-only "$BASE_BRANCH"..."$CURRENT_BRANCH" 2>/dev/null | grep -q "${BASENAME}.*\.test\."; then
    MISSING_TESTS+="    $file\n"
  fi
done
if [[ -n "$MISSING_TESTS" ]]; then
  ISSUES+="🧪 New files without tests in this PR:\n$MISSING_TESTS"
fi

# Display findings
if [[ -n "$ISSUES" ]]; then
  echo "" >&2
  echo "Issues found:" >&2
  echo "───────────────────────────────────────────────────────────────" >&2
  echo -e "$ISSUES" >&2
  echo "───────────────────────────────────────────────────────────────" >&2
else
  echo "" >&2
  echo "✅ No obvious issues found in quick checks." >&2
fi

echo "" >&2
echo "Files in this PR:" >&2
echo "$FILES_CHANGED" | head -15 >&2
[[ $NUM_FILES -gt 15 ]] && echo "... and $((NUM_FILES - 15)) more" >&2
echo "" >&2
echo "═══════════════════════════════════════════════════════════════" >&2

# Informational only - always allow PR creation
exit 0
