/**
 * Tool switcher segmented control.
 *
 * Renders a segmented control to switch between Layout Planner and Bin Designer.
 */

import { useDesignerRouting } from '@/hooks/useDesignerRouting';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';

interface ToolSwitcherProps {
  /** Compact mode for mobile layouts */
  compact?: boolean;
  /** Show icons only (no text labels) */
  iconOnly?: boolean;
}

type Tool = 'planner' | 'designer';

function getSegmentPadding(iconOnly: boolean, compact: boolean): string {
  if (iconOnly && compact) return 'p-1.5';
  if (iconOnly) return 'px-2 py-1';
  if (compact) return 'px-2.5 py-2.5';
  return 'px-3 py-1';
}

function getIconSize(iconOnly: boolean, compact: boolean): string {
  if (iconOnly && compact) return 'w-5 h-5';
  if (compact) return 'w-3.5 h-3.5';
  return 'w-4 h-4';
}

/**
 * Renders a segmented control for switching between Layout Planner and Bin Designer.
 */
export function ToolSwitcher({ compact = false, iconOnly = false }: ToolSwitcherProps) {
  const t = useTranslation();
  const { isDesignerRoute, navigateToDesigner, navigateToPlanner } = useDesignerRouting();

  const activeTool: Tool = isDesignerRoute ? 'designer' : 'planner';

  const handleSwitch = (tool: Tool) => {
    if (tool === activeTool) return;
    if (tool === 'designer') {
      navigateToDesigner();
    } else {
      navigateToPlanner();
    }
  };

  const segmentPadding = getSegmentPadding(iconOnly, compact);
  const fontSize = compact ? 'text-xs' : 'text-sm';
  const iconSize = getIconSize(iconOnly, compact);

  const segmentClass = (tool: Tool) =>
    `${segmentPadding} ${fontSize} font-medium rounded-md transition-all flex items-center justify-center gap-1.5 leading-none ${
      activeTool === tool
        ? 'bg-surface-elevated text-content shadow-sm'
        : 'text-content-tertiary hover:text-content-secondary'
    }`;

  return (
    <div role="navigation" aria-label={t('toolSwitcher.toolSwitcher')} className="flex-shrink-0">
      <div
        className="flex whitespace-nowrap rounded-lg bg-surface p-0.5 border border-stroke-subtle"
        role="tablist"
        aria-label={t('toolSwitcher.activeTool')}
      >
        <button
          role="tab"
          aria-selected={activeTool === 'planner'}
          onClick={() => handleSwitch('planner')}
          title={activeTool !== 'planner' ? t('toolSwitcher.switchToPlanner') : undefined}
          className={segmentClass('planner')}
        >
          <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {ICON_PATHS.dashboard.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
            ))}
          </svg>
          {!iconOnly && t('toolSwitcher.gridEditor')}
        </button>
        <button
          role="tab"
          aria-selected={activeTool === 'designer'}
          onClick={() => handleSwitch('designer')}
          title={activeTool !== 'designer' ? t('toolSwitcher.switchToDesigner') : undefined}
          className={segmentClass('designer')}
        >
          <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {ICON_PATHS.cube.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
            ))}
          </svg>
          {!iconOnly && t('toolSwitcher.binDesigner')}
        </button>
      </div>
    </div>
  );
}
