#!/usr/bin/env bash
# GitHub starts scheduled runs hours late, so a fixed cron slot drifts out of
# its activity trough. release.yml fires every hour instead, and this gate
# admits one run per low-activity window, and at most two per UTC date: the
# evening window crosses midnight, so one release per window alone can put
# three on one date. It does arithmetic on epoch seconds only, because GNU and
# BSD `date` parse date strings differently.
set -euo pipefail

# start_hour:hours, in UTC.
WINDOWS="5:3 23:2"
MAX_PER_DAY=2

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
# so the merge times say what already shipped.
if [ -z "${RELEASE_EPOCHS+set}" ]; then
  RELEASE_EPOCHS=$(gh api "repos/$GITHUB_REPOSITORY/commits?sha=main&per_page=100" \
    --jq '.[] | select(.commit.message | startswith("chore(main): release ")) | .commit.committer.date | fromdateiso8601')
fi

day_start=$((now - now % 86400))
today=0
for t in $RELEASE_EPOCHS; do
  if [ "$t" -ge "$window_start" ]; then
    echo "go=false"
    echo "A release already merged in this window." >&2
    exit 0
  fi
  if [ "$t" -ge "$day_start" ]; then
    today=$((today + 1))
  fi
done

if [ "$today" -ge "$MAX_PER_DAY" ]; then
  echo "go=false"
  echo "$today releases already merged on this UTC date." >&2
  exit 0
fi

echo "go=true"
