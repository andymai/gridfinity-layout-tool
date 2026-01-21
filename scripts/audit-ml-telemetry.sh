#!/bin/bash
#
# ML Telemetry Production Audit Script
#
# Usage: ./scripts/audit-ml-telemetry.sh
#
# Requires: REDIS_URL environment variable (from .env.local or Vercel)
#
set -e

# Load environment
if [ -f .env.local ]; then
  # shellcheck disable=SC1091
  source .env.local
fi

if [ -z "$REDIS_URL" ]; then
  echo "Error: REDIS_URL not set."
  echo "Run: vercel env pull .env.local --environment=production"
  exit 1
fi

REDIS="redis-cli -u $REDIS_URL"

# Suppress redis-cli password warning
exec 2>/dev/null

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           ML TELEMETRY PRODUCTION AUDIT                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 1. Overview
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ OVERVIEW                                                     │"
echo "└─────────────────────────────────────────────────────────────┘"
total_keys=$($REDIS KEYS 'ml:*' | wc -l)
passed=$($REDIS GET 'ml:meta:validation:passed' || echo "0")
failed=$($REDIS GET 'ml:meta:validation:failed' || echo "0")

# Handle empty/null values
passed=${passed:-0}
failed=${failed:-0}
total_events=$((passed + failed))

echo "Total ml: keys:      $total_keys"
echo "Events passed:       $passed"
echo "Events failed:       $failed"
if [ "$total_events" -gt 0 ]; then
  rate=$(echo "scale=1; $failed * 100 / $total_events" | bc)
  echo "Failure rate:        ${rate}%"

  # Color-coded status
  if [ "$(echo "$rate > 10" | bc)" -eq 1 ]; then
    echo "Status:              ⚠️  CRITICAL (>10% failures)"
  elif [ "$(echo "$rate > 5" | bc)" -eq 1 ]; then
    echo "Status:              ⚡ WARNING (5-10% failures)"
  else
    echo "Status:              ✅ HEALTHY (<5% failures)"
  fi
fi
echo ""

# 2. Key Distribution
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ KEY DISTRIBUTION                                            │"
echo "└─────────────────────────────────────────────────────────────┘"
for prefix in "ml:label_hash:" "ml:embed:" "ml:cooccur:" "ml:first_label:" "ml:clusters:" "ml:trans:" "ml:drawer:" "ml:neg:" "ml:session:"; do
  count=$($REDIS KEYS "${prefix}*" | wc -l)
  printf "%-20s %d keys\n" "$prefix*" "$count"
done
echo ""

# 3. Validation Failures
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ VALIDATION FAILURES BY TYPE                                 │"
echo "└─────────────────────────────────────────────────────────────┘"
failures=$($REDIS HGETALL "ml:meta:validation:failed_by_type")
if [ -n "$failures" ]; then
  echo "$failures" | paste - - | sort -t$'\t' -k2 -nr | while read -r type count; do
    printf "%-30s %s\n" "$type" "$count"
  done
else
  echo "(no failures recorded)"
fi
echo ""

# 4. Top Bin Sizes
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ TOP 15 BIN SIZES                                            │"
echo "└─────────────────────────────────────────────────────────────┘"
sizes=$($REDIS HGETALL "ml:sizes")
if [ -n "$sizes" ]; then
  echo "$sizes" | paste - - | sort -t$'\t' -k2 -nr | head -15 | while read -r size count; do
    printf "%-15s %s\n" "$size" "$count"
  done
else
  echo "(no size data)"
fi
echo ""

# 5. Snapshot Triggers
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ SNAPSHOT TRIGGERS                                           │"
echo "└─────────────────────────────────────────────────────────────┘"
triggers=$($REDIS HGETALL "ml:triggers")
if [ -n "$triggers" ]; then
  echo "$triggers" | paste - - | sort -t$'\t' -k2 -nr | while read -r trigger count; do
    printf "%-20s %s\n" "$trigger" "$count"
  done
else
  echo "(no trigger data)"
fi
echo ""

# 6. Layout Archetypes
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ LAYOUT ARCHETYPES                                           │"
echo "└─────────────────────────────────────────────────────────────┘"
archetypes=$($REDIS HGETALL "ml:archetype")
if [ -n "$archetypes" ]; then
  echo "$archetypes" | paste - - | sort -t$'\t' -k2 -nr | while read -r type count; do
    printf "%-20s %s\n" "$type" "$count"
  done
else
  echo "(no archetype data)"
fi
echo ""

# 7. Quality Tiers
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ QUALITY TIERS                                               │"
echo "└─────────────────────────────────────────────────────────────┘"
tiers=$($REDIS HGETALL "ml:quality_tier")
if [ -n "$tiers" ]; then
  echo "$tiers" | paste - - | sort -t$'\t' -k2 -nr | while read -r tier count; do
    printf "%-15s %s\n" "$tier" "$count"
  done
else
  echo "(no quality tier data)"
fi
echo ""

# 8. Contextual Signals (new in PR #266)
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ CONTEXTUAL SIGNALS                                         │"
echo "└─────────────────────────────────────────────────────────────┘"

echo "Resize Direction (grow = too small, shrink = too big):"
resize_dir=$($REDIS HGETALL "ml:resize_direction")
if [ -n "$resize_dir" ]; then
  echo "$resize_dir" | paste - - | while read -r dir count; do
    printf "  %-15s %s\n" "$dir" "$count"
  done
else
  echo "  (no resize direction data)"
fi
echo ""

echo "Resize Area Delta:"
resize_delta=$($REDIS HGETALL "ml:resize_delta")
if [ -n "$resize_delta" ]; then
  echo "$resize_delta" | paste - - | while read -r bucket count; do
    printf "  %-15s %s\n" "$bucket" "$count"
  done
else
  echo "  (no area delta data)"
fi
echo ""

echo "Adjacent Bin Count Distribution:"
adj_counts=$($REDIS HGETALL "ml:adjacent_counts")
if [ -n "$adj_counts" ]; then
  echo "$adj_counts" | paste - - | while read -r bucket count; do
    printf "  %-15s %s\n" "$bucket" "$count"
  done
else
  echo "  (no adjacent count data)"
fi
echo ""

echo "Top Placement Sequences (first 10):"
sequences=$($REDIS HGETALL "ml:sequences")
if [ -n "$sequences" ]; then
  echo "$sequences" | paste - - | sort -t$'\t' -k2 -nr | head -10 | while read -r seq count; do
    printf "  %-30s %s\n" "$seq" "$count"
  done
else
  echo "  (no sequence data)"
fi
echo ""

# 9. Negative Signals
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ NEGATIVE SIGNALS                                            │"
echo "└─────────────────────────────────────────────────────────────┘"
echo "Undos:"
undos=$($REDIS HGETALL "ml:neg:undos")
if [ -n "$undos" ]; then
  echo "$undos" | paste - - | while read -r action count; do
    printf "  %-20s %s\n" "$action" "$count"
  done
else
  echo "  (no undo data)"
fi
echo ""

echo "Quick Corrections:"
corrections=$($REDIS HGETALL "ml:neg:quick_corrections")
if [ -n "$corrections" ]; then
  echo "$corrections" | paste - - | while read -r type count; do
    printf "  %-20s %s\n" "$type" "$count"
  done
else
  echo "  (no correction data)"
fi
echo ""

echo "Undo Timing:"
timing=$($REDIS HGETALL "ml:neg:undo_timing")
if [ -n "$timing" ]; then
  echo "$timing" | paste - - | while read -r bucket count; do
    printf "  %-20s %s\n" "$bucket" "$count"
  done
else
  echo "  (no timing data)"
fi
echo ""

echo "Top 10 Deleted Sizes (sizes users regret):"
deleted=$($REDIS HGETALL "ml:neg:deleted_sizes")
if [ -n "$deleted" ]; then
  echo "$deleted" | paste - - | sort -t$'\t' -k2 -nr | head -10 | while read -r size count; do
    printf "  %-15s %s\n" "$size" "$count"
  done
else
  echo "  (no deletion data)"
fi
echo ""

echo "Top 10 Abandoned Sizes (placed but never used):"
abandoned=$($REDIS HGETALL "ml:neg:abandoned_sizes")
if [ -n "$abandoned" ]; then
  echo "$abandoned" | paste - - | sort -t$'\t' -k2 -nr | head -10 | while read -r size count; do
    printf "  %-15s %s\n" "$size" "$count"
  done
else
  echo "  (no abandonment data)"
fi
echo ""

echo "Abandonment Lifetime (how long before abandoned):"
abandon_lifetime=$($REDIS HGETALL "ml:neg:abandon_lifetime")
if [ -n "$abandon_lifetime" ]; then
  echo "$abandon_lifetime" | paste - - | while read -r bucket count; do
    printf "  %-15s %s\n" "$bucket" "$count"
  done
else
  echo "  (no lifetime data)"
fi
echo ""

# 10. Session Summary
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ SESSION SUMMARY                                             │"
echo "└─────────────────────────────────────────────────────────────┘"
total_sessions=$($REDIS HGET 'ml:session:totals' 'total' || echo "0")
total_sessions=${total_sessions:-0}
echo "Total sessions: $total_sessions"
echo ""

echo "Bins placed distribution:"
bins_placed=$($REDIS HGETALL "ml:session:bins_placed")
if [ -n "$bins_placed" ]; then
  echo "$bins_placed" | paste - - | while read -r bucket count; do
    printf "  %-15s %s\n" "$bucket" "$count"
  done
else
  echo "  (no data)"
fi
echo ""

echo "Confidence distribution:"
confidence=$($REDIS HGETALL "ml:session:confidence")
if [ -n "$confidence" ]; then
  echo "$confidence" | paste - - | while read -r level count; do
    printf "  %-15s %s\n" "$level" "$count"
  done
else
  echo "  (no data)"
fi
echo ""

# 11. Vocab Versions
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ VOCABULARY VERSIONS                                         │"
echo "└─────────────────────────────────────────────────────────────┘"
versions=$($REDIS HGETALL "ml:meta:vocab_versions")
if [ -n "$versions" ]; then
  echo "$versions" | paste - - | while read -r version count; do
    printf "%-10s %s events\n" "$version" "$count"
  done
else
  echo "(no version data)"
fi
echo ""

# 12. Sample Data
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ SAMPLE DATA                                                 │"
echo "└─────────────────────────────────────────────────────────────┘"

echo "Sample drawer sizes (first 5):"
for key in $($REDIS KEYS 'ml:drawer:*' | head -5); do
  drawer_size=${key#ml:drawer:}
  echo "  $drawer_size:"
  $REDIS HGETALL "$key" | paste - - | head -3 | while read -r size count; do
    printf "    %-12s %s\n" "$size" "$count"
  done
done
echo ""

echo "Sample transitions (first 3):"
for key in $($REDIS KEYS 'ml:trans:*' | head -3); do
  from_size=${key#ml:trans:}
  echo "  From $from_size →"
  $REDIS HGETALL "$key" | paste - - | head -3 | while read -r to_size count; do
    printf "    → %-12s %s\n" "$to_size" "$count"
  done
done
echo ""

echo "Sample first-of-label choices (first 5):"
for key in $($REDIS KEYS 'ml:first_label:*' | head -5); do
  label_hash=${key#ml:first_label:}
  echo "  Label $label_hash:"
  $REDIS HGETALL "$key" | paste - - | head -3 | while read -r size count; do
    printf "    %-12s %s\n" "$size" "$count"
  done
done
echo ""

echo "Sample label co-occurrences (first 3):"
for key in $($REDIS KEYS 'ml:cooccur:*' | head -3); do
  label_hash=${key#ml:cooccur:}
  echo "  Label $label_hash appears with:"
  $REDIS HGETALL "$key" | paste - - | head -3 | while read -r other_hash count; do
    printf "    %-12s %s times\n" "$other_hash" "$count"
  done
done
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    AUDIT COMPLETE                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "For more details, see: docs/ml-telemetry-audit.md"
