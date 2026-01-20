# Claude Hooks Design

## Problem

CodeRabbit PR reviews catch issues 5-10 minutes after PR creation, causing context switches to address feedback. Common issues include:

- **Accessibility gaps**: Missing `aria-*`, `role` on interactive elements
- **Test coverage**: New behavior without tests
- **Edge cases**: Hard-coded values that break at extremes
- **Performance**: O(n²) loops, memory leaks, unnecessary re-renders
- **Code quality**: Redundant code, unclear UI text

## Solution

Four Claude hooks that catch these issues locally before they reach PR review.

## Hook 1: Silent Auto-Test

**Trigger:** PostToolUse on `Edit` or `Write` for `src/**/*.{ts,tsx}`

**Behavior:**
1. Detect changed file
2. Find related test file (same name with `.test.` suffix)
3. Run tests silently in background
4. Only surface output if tests fail
5. Show brief failure summary

**Blocking:** No - informational only

**Implementation:**

```bash
# .claude/hooks/post-edit-test.sh
#!/bin/bash
FILE="$1"

# Skip non-src files and test files
[[ "$FILE" != src/* ]] && exit 0
[[ "$FILE" == *.test.* ]] && exit 0

# Find test file
TEST_FILE="${FILE%.tsx}.test.tsx"
[[ ! -f "$TEST_FILE" ]] && TEST_FILE="${FILE%.ts}.test.ts"
[[ ! -f "$TEST_FILE" ]] && exit 0

# Run tests silently
OUTPUT=$(npm run test:run -- --reporter=dot "$TEST_FILE" 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "✗ Tests failed for $(basename $TEST_FILE)"
  echo "$OUTPUT" | tail -20
  exit 1
fi
```

**Hook config:**

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "command": ".claude/hooks/post-edit-test.sh $TOOL_INPUT.file_path"
    }]
  }
}
```

## Hook 2: Accessibility Check

**Trigger:** PreToolUse on `Bash` when command matches `git commit`

**Behavior:**
1. Get staged `.tsx` files (excluding tests)
2. Check for common a11y issues:
   - `tabIndex` without corresponding `role`
   - `onClick` on div without `role`/`tabIndex`
   - Empty `aria-label` attributes
   - Interactive elements missing `aria-controls`
3. Block commit if issues found

**Blocking:** Yes

**Implementation:**

```bash
# .claude/hooks/a11y-check.sh
#!/bin/bash
STAGED=$(git diff --cached --name-only --diff-filter=d '*.tsx' | grep -v '\.test\.')
[[ -z "$STAGED" ]] && exit 0

ISSUES=""
for file in $STAGED; do
  # tabIndex without role
  if grep -Pn 'tabIndex=\{0\}' "$file" | while read -r match; do
    LINE=$(echo "$match" | cut -d: -f1)
    if ! sed -n "${LINE}p" "$file" | grep -q 'role='; then
      echo "$file:$LINE: tabIndex without role"
    fi
  done | grep -q .; then
    ISSUES+="$(grep -Pn 'tabIndex=\{0\}' "$file" | head -1)\n"
  fi

  # onClick on div without role
  if grep -n '<div[^>]*onClick' "$file" | grep -v -E 'role=|tabIndex' > /dev/null; then
    ISSUES+="$file: onClick on div without role/tabIndex\n"
  fi

  # Empty aria-label
  if grep -n 'aria-label=""' "$file" > /dev/null; then
    ISSUES+="$file: empty aria-label attribute\n"
  fi
done

if [[ -n "$ISSUES" ]]; then
  echo "⚠️  Accessibility issues detected:"
  echo -e "$ISSUES"
  exit 1
fi
```

**Hook config:**

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "condition": "$TOOL_INPUT.command matches 'git commit'",
      "command": ".claude/hooks/a11y-check.sh"
    }]
  }
}
```

## Hook 3: Coverage Gap Detection

**Trigger:** PreToolUse on `Bash` when command matches `git commit`

**Behavior:**
1. Get staged source files (excluding tests)
2. Check if corresponding test file exists for new files
3. Check if new exports appear in tests
4. Warn but don't block

**Blocking:** No - warning only

**Implementation:**

```bash
# .claude/hooks/coverage-check.sh
#!/bin/bash
WARNINGS=""

# New files without test files
NEW_FILES=$(git diff --cached --name-only --diff-filter=A 'src/**/*.ts' 'src/**/*.tsx' | grep -v '\.test\.')
for file in $NEW_FILES; do
  TEST_FILE="${file%.tsx}.test.tsx"
  [[ ! -f "$TEST_FILE" ]] && TEST_FILE="${file%.ts}.test.ts"

  if [[ ! -f "$TEST_FILE" ]]; then
    WARNINGS+="⚠️  No test file for new file: $file\n"
  fi
done

# Modified files with new exports
MODIFIED=$(git diff --cached --name-only --diff-filter=M 'src/**/*.ts' 'src/**/*.tsx' | grep -v '\.test\.')
for file in $MODIFIED; do
  NEW_EXPORTS=$(git diff --cached "$file" | grep '^+export' | grep -v '^+++' | grep -oP '(?<=function |const |class )\w+')
  [[ -z "$NEW_EXPORTS" ]] && continue

  TEST_FILE="${file%.tsx}.test.tsx"
  [[ ! -f "$TEST_FILE" ]] && TEST_FILE="${file%.ts}.test.ts"
  [[ ! -f "$TEST_FILE" ]] && continue

  for func in $NEW_EXPORTS; do
    if ! grep -q "$func" "$TEST_FILE" 2>/dev/null; then
      WARNINGS+="⚠️  New export '$func' in $file not found in tests\n"
    fi
  done
done

if [[ -n "$WARNINGS" ]]; then
  echo "📋 Test coverage gaps (warning only):"
  echo -e "$WARNINGS"
fi
exit 0  # Don't block
```

## Hook 4: Pre-PR Review

**Trigger:** PreToolUse on `Bash` when command matches `gh pr create`

**Behavior:**
1. Gather diff and changed files
2. Run Claude review focused on CodeRabbit-style issues
3. Show findings and ask for confirmation
4. User can proceed, fix, or abort

**Blocking:** Yes (with confirmation)

**Implementation:**

```bash
# .claude/hooks/pre-pr-review.sh
#!/bin/bash
echo "🔍 Running pre-PR review..."

# Gather context
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
DIFF=$(git diff "$BASE_BRANCH"...HEAD)
FILES=$(git diff --name-only "$BASE_BRANCH"...HEAD)
COMMITS=$(git log --oneline "$BASE_BRANCH"..HEAD)

# Create review prompt
PROMPT=$(cat << EOF
Review this PR for issues before submission. Focus on what CodeRabbit would catch:

## Checklist:
1. **Accessibility**: Missing aria-*, role on interactive elements, keyboard navigation gaps
2. **Edge cases**: Hard-coded values (max-height, array limits), missing null/undefined checks
3. **Performance**: O(n²) or worse algorithms, event listeners without cleanup, unnecessary re-renders
4. **Test coverage**: New behavior/branches without tests, untested error paths
5. **Code quality**: Redundant code, unclear variable names, missing error handling

## Changed files:
$FILES

## Commits:
$COMMITS

## Diff:
$DIFF

List specific issues with file:line references and suggested fixes.
If the PR looks good, respond with just "LGTM".
EOF
)

# Run review (uses Claude Code's built-in capability)
echo "$PROMPT" | claude --print 2>/dev/null

echo ""
read -p "Proceed with PR creation? [y/N] " -n 1 -r
echo
[[ $REPLY =~ ^[Yy]$ ]] && exit 0 || exit 1
```

**Note:** The actual implementation will use Claude Code's hook system which has direct access to Claude, rather than shelling out.

## Hook Configuration

Combined `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": ".claude/hooks/post-edit-test.sh \"$FILE_PATH\""
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "condition": "command =~ /git commit/",
        "commands": [
          ".claude/hooks/a11y-check.sh",
          ".claude/hooks/coverage-check.sh"
        ]
      },
      {
        "matcher": "Bash",
        "condition": "command =~ /gh pr create/",
        "command": ".claude/hooks/pre-pr-review.sh"
      }
    ]
  }
}
```

## Expected Outcomes

- **Catch 70-80%** of CodeRabbit issues locally
- **Reduce context switches** from 5-10 min post-PR to near-zero
- **Silent when passing** - no noise in normal workflow
- **Informative when failing** - specific issues with file:line references

## Implementation Order

1. **Auto-test** (lowest risk, immediate value)
2. **A11y check** (mechanical, high-value based on PR history)
3. **Coverage gap** (warning-only, low friction)
4. **Pre-PR review** (most complex, highest value)
