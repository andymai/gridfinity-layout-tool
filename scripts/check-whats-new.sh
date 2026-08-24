#!/usr/bin/env bash
# check-whats-new.sh - Remind to announce user-facing features, and catch marker drift
#
# Two reminders, both non-blocking (always exits 0). CI's latest.test.ts is the
# gate that actually fails on drift; this only surfaces it earlier.
#
#   1. A staged feature touching src/features/ with no entry added. Most feats
#      genuinely do not warrant one, which is why this cannot block.
#   2. LATEST_ENTRY_ID out of sync with the newest entry.

trap 'exit 0' ERR

ENTRIES="src/features/whats-new/entries.ts"
LATEST="src/features/whats-new/latest.ts"

STAGED=$(git diff --cached --name-only --diff-filter=ACMR || true)
[ -z "$STAGED" ] && exit 0

YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Marker drift, cheap enough to check on every commit that touches either file.
if [ -f "$ENTRIES" ] && [ -f "$LATEST" ]; then
  NEWEST=$(grep -m1 -oE "id: '[^']+'" "$ENTRIES" | head -1 | sed "s/id: '//; s/'$//")
  MARKER=$(grep -oE "LATEST_ENTRY_ID = '[^']+'" "$LATEST" | sed "s/LATEST_ENTRY_ID = '//; s/'$//")
  if [ -n "$NEWEST" ] && [ -n "$MARKER" ] && [ "$NEWEST" != "$MARKER" ]; then
    printf "${YELLOW}⚠ whats-new:${NC} LATEST_ENTRY_ID is '%s' but the newest entry is '%s'.\n" \
      "$MARKER" "$NEWEST"
    printf "  Update %s. The sidebar badge reads that constant.\n\n" "$LATEST"
  fi
fi

# 2. A feature shipped without an entry.
echo "$STAGED" | grep -q "^$ENTRIES$" && exit 0

case "$(git log -1 --format=%s 2>/dev/null)" in
  feat*) ;;
  *)
    # No commit message yet at pre-commit time, so fall back to the branch name.
    case "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" in
      feat/*) ;;
      *) exit 0 ;;
    esac
    ;;
esac

TOUCHED=$(echo "$STAGED" | grep -E '^src/features/' | grep -vE '\.test\.|\.spec\.' | head -3 || true)
[ -z "$TOUCHED" ] && exit 0

printf "${YELLOW}⚠ whats-new:${NC} this change touches a feature but adds no entry to\n"
printf "  %s:\n" "$ENTRIES"
echo "$TOUCHED" | sed 's/^/    /'
printf "  Add one if users should hear about it (id, date and an English title is enough).\n\n"

exit 0
