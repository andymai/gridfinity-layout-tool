#!/usr/bin/env bash
# Prints go=true when a scheduled release run may release now, else go=false.
#
# GitHub starts scheduled runs hours late, so a fixed cron slot drifts out of
# its activity trough. release.yml fires every hour instead, and this gate
# admits one run per low-activity window. It does arithmetic on epoch seconds
# only, because GNU and BSD `date` parse date strings differently.
set -euo pipefail

# start_hour:hours, in UTC.
WINDOWS="5:3 23:2"

now=${NOW:-$(date -u +%s)}
hour=$((now % 86400 / 3600))

window_start=""
for w in $WINDOWS; do
  start=${w%:*}
  len=${w#*:}
  offset=$(((hour - start + 24) % 24))
  if [ "$offset" -lt "$len" ]; then
    window_start=$((now - now % 3600 - offset * 3600))
    break
  fi
done

if [ -z "$window_start" ]; then
  echo "go=false"
  echo "Hour $hour UTC is outside the release windows." >&2
  exit 0
fi

# The release PR's squash merge is the deploy trigger (scripts/vercel-ignore.sh),
# so its merge time says whether this window already shipped.
if [ -z "${LAST_RELEASE_EPOCH+set}" ]; then
  LAST_RELEASE_EPOCH=$(gh api "repos/$GITHUB_REPOSITORY/commits?sha=main&per_page=100" \
    --jq '[.[] | select(.commit.message | startswith("chore(main): release "))][0].commit.committer.date | if . then fromdateiso8601 else "" end')
fi

if [ -n "$LAST_RELEASE_EPOCH" ] && [ "$LAST_RELEASE_EPOCH" -ge "$window_start" ]; then
  echo "go=false"
  echo "A release already merged in this window." >&2
  exit 0
fi

echo "go=true"
