/**
 * Segmented control for switching between Layout, Bins, Baseplate Generator
 * and the Community gallery.
 *
 * Community is a destination rather than a generator, but it lives here so it
 * is reachable from every surface and so /community renders under the same
 * chrome as the rest of the app instead of behind a "back to app" escape
 * hatch. It appears only while the community_showcase flag is on, and carries
 * an experimental marker (a dot, so it survives the icon-only collapse).
 */

import { Button } from '@/design-system';
import { useCommunityDigestStore } from '@/core/store/communityDigest';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useBaseplateRouting } from '@/shared/hooks/useBaseplateRouting';
import { useCommunityRouting } from '@/shared/hooks/useCommunityRouting';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';

interface ToolSwitcherProps {
  /** Compact mode for mobile layouts */
  compact?: boolean;
  /** Show icons only (no text labels) */
  iconOnly?: boolean;
  /**
   * Drop the labels below 2xl, keeping the icons. For headers that also carry
   * a document name and its actions: the switcher is persistent global nav
   * and its labels are worth less than the name of the thing being edited.
   */
  collapseLabels?: boolean;
}

type Tool = 'planner' | 'designer' | 'baseplate' | 'community';

const NEWS_DOT_TESTID = 'tool-news-dot';
const EXPERIMENTAL_DOT_TESTID = 'tool-experimental-dot';
const LABEL_SUFFIX_SEPARATOR = ', ';

interface ToolConfig {
  id: Tool;
  labelKey:
    | 'toolSwitcher.layout'
    | 'toolSwitcher.binDesigner'
    | 'toolSwitcher.baseplateGenerator'
    | 'toolSwitcher.community';
  switchKey:
    | 'toolSwitcher.switchToPlanner'
    | 'toolSwitcher.switchToDesigner'
    | 'toolSwitcher.switchToBaseplate'
    | 'toolSwitcher.switchToCommunity';
  iconPaths: readonly string[];
  /** Marks the segment as an experimental surface. */
  experimental?: boolean;
}

const TOOLS: ToolConfig[] = [
  {
    id: 'planner',
    labelKey: 'toolSwitcher.layout',
    switchKey: 'toolSwitcher.switchToPlanner',
    iconPaths: ICON_PATHS.dashboard,
  },
  {
    id: 'designer',
    labelKey: 'toolSwitcher.binDesigner',
    switchKey: 'toolSwitcher.switchToDesigner',
    iconPaths: ICON_PATHS.cube,
  },
  {
    id: 'baseplate',
    labelKey: 'toolSwitcher.baseplateGenerator',
    switchKey: 'toolSwitcher.switchToBaseplate',
    iconPaths: ICON_PATHS.baseplate,
  },
  {
    id: 'community',
    labelKey: 'toolSwitcher.community',
    switchKey: 'toolSwitcher.switchToCommunity',
    iconPaths: ICON_PATHS.community,
    experimental: true,
  },
];

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

export function ToolSwitcher({
  compact = false,
  iconOnly = false,
  collapseLabels = false,
}: ToolSwitcherProps) {
  const t = useTranslation();
  const { isDesignerRoute, navigateToDesigner, navigateToPlanner } = useDesignerRouting();
  const { isBaseplateRoute, navigateToBaseplate } = useBaseplateRouting();
  const { isCommunityRoute, navigateToCommunity } = useCommunityRouting();
  const communityEnabled = useFeatureFlag('community_showcase');
  const hasUnseenDigest = useCommunityDigestStore((s) => s.hasUnseenDeltas);

  const tools = communityEnabled ? TOOLS : TOOLS.filter((tool) => tool.id !== 'community');

  const activeTool: Tool = isCommunityRoute
    ? 'community'
    : isBaseplateRoute
      ? 'baseplate'
      : isDesignerRoute
        ? 'designer'
        : 'planner';

  const handleSwitch = (tool: Tool) => {
    if (tool === activeTool) return;
    if (tool === 'designer') {
      navigateToDesigner();
    } else if (tool === 'baseplate') {
      navigateToBaseplate();
    } else if (tool === 'community') {
      navigateToCommunity();
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
        {tools.map(({ id, labelKey, switchKey, iconPaths, experimental }) => {
          // News wins the marker slot. A segment has room for one dot, and
          // "there is something new in here" is actionable where "this is
          // experimental" is a standing property already spelled out on the
          // page the segment leads to. Both stay in the accessible name.
          const hasNews = id === 'community' && hasUnseenDigest;
          const showMarker = hasNews || experimental === true;
          const suffixes = [
            hasNews ? t('binExamples.gallery.tabs.newBadge') : null,
            experimental === true ? t('common.experimental') : null,
          ].filter((value): value is string => value !== null);

          return (
            <Button
              key={id}
              variant="ghost"
              role="tab"
              aria-selected={activeTool === id}
              aria-label={
                suffixes.length > 0
                  ? `${t(labelKey)} (${suffixes.join(LABEL_SUFFIX_SEPARATOR)})`
                  : t(labelKey)
              }
              onClick={() => handleSwitch(id)}
              title={activeTool !== id ? t(switchKey) : undefined}
              className={`${segmentClass(id)} relative`}
            >
              <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {iconPaths.map((d) => (
                  <path
                    key={d}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={d}
                  />
                ))}
              </svg>
              {!iconOnly &&
                (collapseLabels ? (
                  <span className="hidden 2xl:inline">{t(labelKey)}</span>
                ) : (
                  t(labelKey)
                ))}
              {/* Rides the corner rather than the label so the marker survives
                  the icon-only collapse. */}
              {showMarker && (
                <span
                  aria-hidden="true"
                  data-testid={hasNews ? NEWS_DOT_TESTID : EXPERIMENTAL_DOT_TESTID}
                  className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ${
                    hasNews ? 'bg-accent' : 'bg-content-tertiary'
                  }`}
                />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
