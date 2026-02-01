#!/usr/bin/env bash
# check-readme-reminders.sh - Remind to review READMEs when source files change
# Walks up from each staged file's directory looking for README.md on disk
# Zero-config: adding a README anywhere automatically includes it
# Non-blocking: always exits 0 (reminds but does not fail commit)

# ERR trap ensures script never blocks a commit, even on unexpected failures
trap 'exit 0' ERR

# Single git call — cache all staged files
STAGED=$(git diff --cached --name-only --diff-filter=ACMR || true)
[ -z "$STAGED" ] && exit 0

# Single pass: classify each staged file using bash pattern matching (no grep)
declare -A STAGED_READMES DIR_FILE_COUNTS
HAS_SOURCE=false

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  case "$FILE" in */README.md) STAGED_READMES["$FILE"]=1; continue ;; esac
  case "$FILE" in *.ts|*.tsx) ;; *) continue ;; esac
  case "$FILE" in *.test.*|*.spec.*|*.d.ts) continue ;; esac

  DIR="${FILE%/*}"
  [ "$DIR" = "$FILE" ] && DIR="."
  DIR_FILE_COUNTS["$DIR"]=$(( ${DIR_FILE_COUNTS["$DIR"]:-0} + 1 ))
  HAS_SOURCE=true
done <<< "$STAGED"

$HAS_SOURCE || exit 0

# Walk up from each directory, collecting READMEs on disk.
# WALKED cache: if a deeper dir already walked through this ancestor, skip it.
declare -A FOUND_READMES WALKED
for DIR in "${!DIR_FILE_COUNTS[@]}"; do
  CURRENT="$DIR"
  while true; do
    [ "${WALKED[$CURRENT]+_}" ] && break
    WALKED["$CURRENT"]=1
    [ -f "${CURRENT}/README.md" ] && FOUND_READMES["${CURRENT}/README.md"]=1
    PARENT="${CURRENT%/*}"
    [ "$PARENT" = "$CURRENT" ] && break
    CURRENT="$PARENT"
  done
done

[ ${#FOUND_READMES[@]} -eq 0 ] && exit 0

# Sort found READMEs into an array (one sort subprocess, safe for paths with spaces)
readarray -t SORTED < <(printf '%s\n' "${!FOUND_READMES[@]}" | sort)

# Build reminder lines, skipping READMEs already staged
LINES=()

for README_PATH in "${SORTED[@]}"; do
  [ "${STAGED_READMES[$README_PATH]+_}" ] && continue

  # Count staged source files under this README's directory
  README_DIR="${README_PATH%/*}"
  FILE_COUNT=0
  for SDIR in "${!DIR_FILE_COUNTS[@]}"; do
    case "$SDIR" in "$README_DIR"|"$README_DIR"/*) FILE_COUNT=$(( FILE_COUNT + DIR_FILE_COUNTS["$SDIR"] )) ;; esac
  done

  NAME="${README_DIR##*/}"
  SUFFIX="s"; [ "$FILE_COUNT" -eq 1 ] && SUFFIX=""
  LABEL="${NAME} (${FILE_COUNT} file${SUFFIX})"
  PAD=$(( 28 - ${#LABEL} ))
  [ "$PAD" -lt 1 ] && PAD=1
  LINES+=("  ${LABEL}$(printf '%*s' "$PAD" '')→ ${README_PATH}")
done

if [ ${#LINES[@]} -gt 0 ]; then
  printf '\n📘 README review reminder:\n'
  printf '%s\n' "${LINES[@]}"
  printf '  (Review these READMEs if your changes affect architecture, key files, or gotchas)\n\n'
fi

exit 0
