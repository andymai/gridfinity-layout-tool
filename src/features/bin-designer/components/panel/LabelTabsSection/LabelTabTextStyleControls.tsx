/** The collapsed "engraved text" group: finish, font, depth and the shared size control. */

import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { Button, Select, Stepper, InfoIcon, Collapsible } from '@/design-system';
import { LabelSizeControl } from '../../controls';
import type { SelectOption } from '@/design-system';
import type { TextFontFamily, TextMode } from '../../../types';
import { jumpToDesignerControl } from '@/features/bin-designer/settingsManifest';
import { DependencyHint } from '../shared';
import type { useLabelTabsSection } from './useLabelTabsSection';
import type { useTranslation } from '@/i18n';

const MODE_OPTIONS: TextMode[] = ['engrave', 'emboss', 'through-cut'];
const FONT_OPTIONS: readonly TextFontFamily[] = [
  'atkinson',
  'jetbrains-mono',
  'allerta-stencil',
] as const;
/** Per-mode bounds for the engrave/emboss depth stepper. Through-cut ignores
 *  `depth` (cuts through the full shelf), so the picker is hidden in that
 *  mode rather than disabled. */
const TEXT_DEPTH_MIN = 0.2;
const TEXT_DEPTH_MAX = 5;
const TEXT_DEPTH_STEP = 0.1;

interface LabelTabTextStyleControlsProps {
  state: ReturnType<typeof useLabelTabsSection>['state'];
  handlers: ReturnType<typeof useLabelTabsSection>['handlers'];
  t: ReturnType<typeof useTranslation>;
  title: string;
  summary: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}

export function LabelTabTextStyleControls({
  state,
  handlers,
  t,
  title,
  summary,
  expanded,
  onExpandedChange,
}: LabelTabTextStyleControlsProps) {
  return (
    <Collapsible
      title={title}
      summary={summary}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      size="sm"
    >
      <div className="space-y-2">
        {/* Mode picker */}
        <div>
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.textMode')}
          </span>
          <div role="group" aria-label={t('binDesigner.textMode')} className={SEGMENT_GROUP_CLASS}>
            {MODE_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                variant="ghost"
                touchTarget={false}
                onClick={() => handlers.setTextMode(option)}
                aria-pressed={state.textDefaults.mode === option}
                className={`flex-1 ${getSegmentClass(state.textDefaults.mode === option)}`}
              >
                {t(`binDesigner.textMode.${option}`)}
              </Button>
            ))}
          </div>
          {state.textDefaults.mode === 'through-cut' && (
            <p className="mt-1 flex items-start gap-1 text-xs text-content-tertiary">
              <InfoIcon size="xs" className="mt-0.5 shrink-0" />
              <span>{t('binDesigner.textMode.throughCutStencilNote')}</span>
            </p>
          )}
        </div>

        {/* Font + (conditional) depth, side by side when both visible */}
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.textFont')}
            </span>
            <Select
              size="sm"
              fullWidth
              // Through-cut forces Allerta Stencil at render time; show
              // that as the value so the disabled state isn't misleading.
              // The user's font preference is preserved in
              // `textDefaults.font` and restored on switching back.
              value={
                state.textDefaults.mode === 'through-cut'
                  ? 'allerta-stencil'
                  : state.textDefaults.font
              }
              onChange={(e) => handlers.setTextFont(e.target.value as TextFontFamily)}
              disabled={state.textDefaults.mode === 'through-cut'}
              aria-label={t('binDesigner.textFont')}
              options={FONT_OPTIONS.map((f): SelectOption => ({
                id: f,
                name: t(`binDesigner.type.font.${f}`),
              }))}
            />
          </div>
          {state.textDefaults.mode !== 'through-cut' && (
            <div className="min-w-0 flex-1">
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('binDesigner.textDepth')}
              </span>
              <Stepper
                value={state.textDefaults.depth}
                onChange={handlers.setTextDepth}
                onStep={(delta) =>
                  handlers.setTextDepth(
                    Math.min(
                      TEXT_DEPTH_MAX,
                      Math.max(TEXT_DEPTH_MIN, state.textDefaults.depth + delta * TEXT_DEPTH_STEP)
                    )
                  )
                }
                min={TEXT_DEPTH_MIN}
                max={TEXT_DEPTH_MAX}
                step={TEXT_DEPTH_STEP}
                size="md"
                aria-label={t('binDesigner.textDepth')}
              />
            </div>
          )}
        </div>
        <LabelSizeControl
          className="mt-3"
          labelClassName="text-xs text-content-tertiary"
          value={state.label.textStyle?.fontSizeOverride}
          onChange={handlers.setTextSize}
          min={state.textDefaults.minFontSize}
          max={state.textDefaults.maxFontSize}
          explainShared
        />
        <DependencyHint
          reason={t('binDesigner.tabText.sharedTypeNote')}
          actionLabel={t('binDesigner.tabText.editTypography')}
          onAction={() => jumpToDesignerControl('bd-type')}
        />
      </div>
    </Collapsible>
  );
}
