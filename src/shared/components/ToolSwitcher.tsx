/**
 * Tool switcher segmented control.
 *
 * When the bin_designer feature flag is enabled, replaces the static
 * "Gridfinity Layout Tool" title with a segmented control to switch
 * between Layout Planner and Bin Designer.
 *
 * When the flag is off, renders the original static title.
 */

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useDesignerRouting } from '@/hooks/useDesignerRouting';

interface ToolSwitcherProps {
  /** Compact mode for mobile layouts */
  compact?: boolean;
}

/**
 * A small Gridfinity grid icon used as branding next to the segmented control.
 */
function GridfinityIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {/* 2x2 grid of squares representing Gridfinity bins */}
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  );
}

type Tool = 'planner' | 'designer';

/**
 * Renders a segmented control for switching between Layout Planner and Bin Designer,
 * or falls back to a static "Gridfinity Layout Tool" title when the bin_designer
 * feature flag is disabled.
 */
export function ToolSwitcher({ compact = false }: ToolSwitcherProps) {
  const isDesignerEnabled = useFeatureFlag('bin_designer');
  const { isDesignerRoute, navigateToDesigner, navigateToPlanner } = useDesignerRouting();

  // When feature flag is off, show original static title
  if (!isDesignerEnabled) {
    if (compact) {
      return (
        <span className="text-xs font-medium text-content-secondary">Gridfinity Layout Tool</span>
      );
    }
    return <h1 className="text-lg font-semibold text-content">Gridfinity Layout Tool</h1>;
  }

  const activeTool: Tool = isDesignerRoute ? 'designer' : 'planner';

  const handleSwitch = (tool: Tool) => {
    if (tool === activeTool) return;
    if (tool === 'designer') {
      navigateToDesigner();
    } else {
      navigateToPlanner();
    }
  };

  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  const segmentPadding = compact ? 'px-2 py-0.5' : 'px-3 py-1';
  const fontSize = compact ? 'text-xs' : 'text-sm';
  const gap = compact ? 'gap-1.5' : 'gap-2';

  return (
    <div className={`flex items-center ${gap}`} role="navigation" aria-label="Tool switcher">
      <GridfinityIcon className={`${iconSize} text-content-secondary flex-shrink-0`} />
      <div
        className="flex rounded-md bg-surface p-0.5 border border-stroke-subtle"
        role="tablist"
        aria-label="Active tool"
      >
        <button
          role="tab"
          aria-selected={activeTool === 'planner'}
          onClick={() => handleSwitch('planner')}
          className={`${segmentPadding} ${fontSize} font-medium rounded transition-all ${
            activeTool === 'planner'
              ? 'bg-surface-elevated text-content shadow-sm'
              : 'text-content-tertiary hover:text-content-secondary'
          }`}
        >
          Layout Planner
        </button>
        <button
          role="tab"
          aria-selected={activeTool === 'designer'}
          onClick={() => handleSwitch('designer')}
          className={`${segmentPadding} ${fontSize} font-medium rounded transition-all ${
            activeTool === 'designer'
              ? 'bg-surface-elevated text-content shadow-sm'
              : 'text-content-tertiary hover:text-content-secondary'
          }`}
        >
          Bin Designer
        </button>
      </div>
    </div>
  );
}
