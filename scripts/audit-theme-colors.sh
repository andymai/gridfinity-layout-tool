#!/usr/bin/env bash
# =============================================================================
# Theme Color Audit Script
#
# Scans .tsx/.ts source files for hardcoded color values that should use
# CSS custom properties or Tailwind theme tokens instead.
#
# Usage:
#   bash scripts/audit-theme-colors.sh          # Summary only
#   VERBOSE=1 bash scripts/audit-theme-colors.sh  # Show all matches
# =============================================================================

set -euo pipefail

SRC="src"
# Files to scan: TS/TSX source, excluding tests, theme infrastructure, and visual stories
GLOBS=(--glob '*.tsx' --glob '*.ts'
       --glob '!*.test.*' --glob '!*.spec.*' --glob '!**/test/**'
       --glob '!**/useThemeEffect*' --glob '!**/themes.css' --glob '!**/thumbnailRegenerator*'
       --glob '!**/constants.test.*' --glob '!**/visual.tsx'
       --glob '!**/constants.ts' --glob '!**/LayoutService.ts')

RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
DIM='\033[2m'
RESET='\033[0m'

errors=0
warnings=0
infos=0

section() {
  echo ""
  echo -e "${GREEN}━━━ $1 ━━━${RESET}"
}

report() {
  local level="$1" desc="$2" pattern="$3"
  local color
  case "$level" in
    ERROR)   color="$RED" ;;
    WARNING) color="$YELLOW" ;;
    INFO)    color="$CYAN" ;;
  esac

  local matches
  matches=$(rg "$pattern" "$SRC" "${GLOBS[@]}" -c 2>/dev/null \
    | awk -F: '{s+=$NF} END {print s+0}') || matches=0

  if [[ "$matches" -gt 0 ]]; then
    echo -e "  ${color}${level}${RESET} ${desc}: ${color}${matches}${RESET}"
    if [[ "${VERBOSE:-}" == "1" || "$level" == "ERROR" ]]; then
      rg "$pattern" "$SRC" "${GLOBS[@]}" -n --color=always 2>/dev/null \
        | head -30 | sed 's/^/    /'
      [[ "$matches" -gt 30 ]] && echo -e "    ${DIM}... and $((matches - 30)) more${RESET}"
    fi
    case "$level" in
      ERROR)   errors=$((errors + matches)) ;;
      WARNING) warnings=$((warnings + matches)) ;;
      INFO)    infos=$((infos + matches)) ;;
    esac
  fi
}

echo "Theme Color Audit — scanning $SRC/"
echo "═══════════════════════════════════════"

# ─── ERRORS: Inline styles with hardcoded colors ───────────────────────────

section "Inline style hardcoded colors (ERROR)"

report ERROR "style={{ color: 'white'/'black' }}" \
  "color: '(white|black)'"

report ERROR "style={{ background: hardcoded hex }}" \
  "(background|backgroundColor).*'#[0-9a-fA-F]{6}'"

# ─── ERRORS: Tailwind dark: variant (incompatible with data-theme) ────────

section "Tailwind dark: variant (ERROR)"

report ERROR "dark: variant class (use CSS variables instead)" \
  '\bdark:'

# ─── WARNINGS: Non-semantic Tailwind classes ────────────────────────────────

section "Non-semantic Tailwind classes (WARNING)"

report WARNING "text-white on non-colored surface" \
  'className.*text-white[" ]'

report WARNING "bg-white (should use bg-surface)" \
  'className.*bg-white[" ]'

report WARNING "text-slate-*/text-gray-* (use text-content-*)" \
  'text-(slate|gray)-[0-9]'

report WARNING "bg-slate-*/bg-gray-* (use bg-surface-*)" \
  'bg-(slate|gray)-[0-9]'

report WARNING "border-gray-*/border-slate-* (use border-stroke-*)" \
  'border-(gray|slate)-[0-9]'

# ─── INFO: Hardcoded accent refs ───────────────────────────────────────────

section "Hardcoded accent color values (INFO)"

report INFO "#f59e0b amber in non-theme files" \
  '#f59e0b'

# ─── Summary ───────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════"
echo -e "  ${RED}Errors:   $errors${RESET}"
echo -e "  ${YELLOW}Warnings: $warnings${RESET}"
echo -e "  ${CYAN}Info:     $infos${RESET}"
echo ""

if [[ $errors -gt 0 ]]; then
  echo -e "${RED}✗ Theme audit found $errors error(s).${RESET}"
  exit 1
elif [[ $warnings -gt 0 ]]; then
  echo -e "${YELLOW}⚠ Theme audit: $warnings warning(s) to review.${RESET}"
  exit 0
else
  echo -e "${GREEN}✓ No theme color issues.${RESET}"
  exit 0
fi
