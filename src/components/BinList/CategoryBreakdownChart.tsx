import type { CategoryBreakdown } from '../../utils/binListOperations';

export interface CategoryBreakdownChartProps {
  /** Category breakdown data */
  breakdown: CategoryBreakdown[];
  /** Whether to show labels on bars */
  showLabels?: boolean;
  /** Maximum number of categories to show (rest grouped as "Other") */
  maxCategories?: number;
  /** Compact mode for mobile */
  compact?: boolean;
}

/**
 * Horizontal bar chart showing category breakdown by filament usage.
 * Pure CSS implementation - no chart library required.
 */
export function CategoryBreakdownChart({
  breakdown,
  showLabels = true,
  maxCategories = 6,
  compact = false,
}: CategoryBreakdownChartProps) {
  if (breakdown.length === 0) {
    return (
      <div className="text-center py-4 text-content-tertiary text-sm">
        No data to display
      </div>
    );
  }

  // Limit categories and group the rest as "Other"
  let displayData = breakdown;
  if (breakdown.length > maxCategories) {
    const visible = breakdown.slice(0, maxCategories - 1);
    const others = breakdown.slice(maxCategories - 1);
    const otherTotal = others.reduce((sum, c) => sum + c.filament, 0);
    const otherPercentage = others.reduce((sum, c) => sum + c.percentage, 0);

    displayData = [
      ...visible,
      {
        categoryId: 'other',
        categoryName: `Other (${others.length})`,
        categoryColor: '#6B7280',
        filament: Math.round(otherTotal * 10) / 10,
        cost: others.reduce((sum, c) => sum + c.cost, 0),
        binCount: others.reduce((sum, c) => sum + c.binCount, 0),
        percentage: Math.round(otherPercentage * 10) / 10,
      },
    ];
  }

  const barHeight = compact ? 'h-5' : 'h-6';
  const fontSize = compact ? 'text-xs' : 'text-sm';
  const gap = compact ? 'gap-1.5' : 'gap-2';

  return (
    <div className={`flex flex-col ${gap}`}>
      {displayData.map((category) => (
        <div
          key={category.categoryId}
          className="flex items-center gap-2"
          title={`${category.categoryName}: ${category.filament}m (${category.percentage}%)`}
        >
          {/* Category name */}
          {showLabels && (
            <div
              className={`w-20 ${fontSize} text-content-secondary truncate flex-shrink-0`}
              title={category.categoryName}
            >
              {category.categoryName}
            </div>
          )}

          {/* Bar container */}
          <div className={`flex-1 ${barHeight} bg-surface rounded overflow-hidden`}>
            {/* Filled bar */}
            <div
              className={`${barHeight} transition-all duration-300 ease-out`}
              style={{
                width: `${Math.max(category.percentage, 2)}%`, // Min 2% for visibility
                backgroundColor: category.categoryColor,
              }}
            />
          </div>

          {/* Value */}
          <div className={`w-12 ${fontSize} text-content-tertiary text-right tabular-nums flex-shrink-0`}>
            {category.percentage}%
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Stacked horizontal bar showing all categories in one bar.
 * Good for compact displays where vertical space is limited.
 */
export function CategoryStackedBar({
  breakdown,
  height = 'h-4',
}: {
  breakdown: CategoryBreakdown[];
  height?: string;
}) {
  if (breakdown.length === 0) {
    return <div className={`${height} bg-surface rounded`} />;
  }

  return (
    <div
      className={`${height} bg-surface rounded overflow-hidden flex`}
      role="img"
      aria-label="Category breakdown"
    >
      {breakdown.map((category) => (
        <div
          key={category.categoryId}
          className={`${height} transition-all duration-300`}
          style={{
            width: `${category.percentage}%`,
            backgroundColor: category.categoryColor,
          }}
          title={`${category.categoryName}: ${category.percentage}%`}
        />
      ))}
    </div>
  );
}

/**
 * Legend for the category breakdown chart.
 * Shows category colors and names.
 */
export function CategoryLegend({
  breakdown,
  compact = false,
}: {
  breakdown: CategoryBreakdown[];
  compact?: boolean;
}) {
  const gap = compact ? 'gap-2' : 'gap-3';
  const dotSize = compact ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const fontSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={`flex flex-wrap ${gap}`}>
      {breakdown.map((category) => (
        <div key={category.categoryId} className="flex items-center gap-1.5">
          <div
            className={`${dotSize} rounded-full flex-shrink-0`}
            style={{ backgroundColor: category.categoryColor }}
          />
          <span className={`${fontSize} text-content-secondary`}>
            {category.categoryName}
          </span>
        </div>
      ))}
    </div>
  );
}
