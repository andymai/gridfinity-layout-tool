#!/usr/bin/env bash
# test-affected.sh - Run tests only for files affected by staged changes
# Optimized for pre-commit hooks on high-core-count systems (e.g., Ryzen 9 7950X3D)
#
# Strategy:
# - Pre-commit: Run affected tests WITHOUT coverage (fast feedback)
# - CI: Run full test suite WITH coverage thresholds
#
# This avoids the issue where partial test runs can't meet global coverage thresholds.

set -e

# Get staged TypeScript/TSX files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
  echo "✓ No staged TypeScript files, skipping tests"
  exit 0
fi

# Count changed files
FILE_COUNT=$(echo "$STAGED_FILES" | wc -l)

# Threshold for switching to full test suite
# `vitest related` analyzes import graphs, which can be slow with many files
MAX_FILES_FOR_RELATED=15

echo "📁 Staged TypeScript files: $FILE_COUNT"

if [ "$FILE_COUNT" -gt "$MAX_FILES_FOR_RELATED" ]; then
  echo "🔄 Many files changed ($FILE_COUNT > $MAX_FILES_FOR_RELATED), running full test suite..."
  pnpm exec vitest run
else
  echo "🎯 Running tests related to changed files..."
  # Convert newlines to spaces for vitest related command
  FILES_ARGS=$(echo "$STAGED_FILES" | tr '\n' ' ')

  # Run related tests (no coverage - thresholds checked in CI)
  # shellcheck disable=SC2086
  pnpm exec vitest related $FILES_ARGS --run
fi

echo "✓ Tests passed"
