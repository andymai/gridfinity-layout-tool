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

  const isCompactIcon = iconOnly && compact;
  const segmentPadding = isCompactIcon
    ? 'p-1'
    : iconOnly
      ? 'px-2 py-1'
      : compact
        ? 'px-2.5 py-2.5'
        : 'px-3 py-1';
  const fontSize = compact ? 'text-xs' : 'text-sm';
  const iconSize = isCompactIcon ? 'w-4 h-4' : compact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const segmentClass = (tool: Tool) =>
    `${segmentPadding} ${fontSize} font-medium rounded transition-all flex items-center justify-center gap-1.5 ${isCompactIcon ? 'leading-none' : ''} ${
      activeTool === tool
        ? 'bg-surface-elevated text-content shadow-sm'
        : 'text-content-tertiary hover:text-content-secondary'
    }`;

  const wrapperClass = isCompactIcon
    ? 'flex rounded bg-surface border border-stroke-subtle'
    : 'flex rounded-md bg-surface p-0.5 border border-stroke-subtle';

  return (
    <div role="navigation" aria-label={t('toolSwitcher.toolSwitcher')}>
      <div className={wrapperClass} role="tablist" aria-label={t('toolSwitcher.activeTool')}>
        <button
          role="tab"
          aria-selected={activeTool === 'planner'}
          onClick={() => handleSwitch('planner')}
          title={t('toolSwitcher.switchToPlanner')}
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
          title={t('toolSwitcher.switchToDesigner')}
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
