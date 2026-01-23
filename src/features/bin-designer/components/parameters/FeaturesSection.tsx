/**
 * Interior features section: dividers, scoop, and label controls.
 * Vase mode disables all features with an explanation.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { Checkbox } from '@/shared/components/Checkbox';
import { SliderInput } from '../controls/SliderInput';
import type { DividerConfig, LabelConfig } from '@/features/bin-designer/types';

export function FeaturesSection() {
  const { dividers, scoop, label, style, setParam } = useDesignerStore(
    useShallow((s) => ({
      dividers: s.params.dividers,
      scoop: s.params.scoop,
      label: s.params.label,
      style: s.params.style,
      setParam: s.setParam,
    }))
  );

  const isVase = style === 'vase';

  const updateDividers = (partial: Partial<DividerConfig>) => {
    setParam('dividers', { ...dividers, ...partial });
  };

  const updateLabel = (partial: Partial<LabelConfig>) => {
    setParam('label', { ...label, ...partial });
  };

  if (isVase) {
    return (
      <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
        <p className="text-xs text-amber-400">
          Interior features are disabled for vase mode bins (single-wall construction).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dividers X */}
      <SliderInput
        label="Dividers X"
        value={dividers.x}
        onChange={(v) => updateDividers({ x: v })}
        min={0}
        max={DESIGNER_CONSTRAINTS.MAX_DIVIDERS}
        step={1}
        info={dividers.x > 0 ? `${dividers.x + 1} columns` : undefined}
      />

      {/* Dividers Y */}
      <SliderInput
        label="Dividers Y"
        value={dividers.y}
        onChange={(v) => updateDividers({ y: v })}
        min={0}
        max={DESIGNER_CONSTRAINTS.MAX_DIVIDERS}
        step={1}
        info={dividers.y > 0 ? `${dividers.y + 1} rows` : undefined}
      />

      {/* Divider thickness (only if dividers enabled) */}
      {(dividers.x > 0 || dividers.y > 0) && (
        <SliderInput
          label="Divider Thickness"
          value={dividers.thickness}
          onChange={(v) => updateDividers({ thickness: v })}
          min={DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS}
          max={DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS}
          step={0.1}
          unit="mm"
        />
      )}

      {/* Scoop */}
      <Checkbox
        checked={scoop}
        onChange={(checked) => setParam('scoop', checked)}
        label="Finger scoop"
        ariaLabel="Enable finger scoop"
      />

      {/* Label */}
      <div className="space-y-2">
        <Checkbox
          checked={label.enabled}
          onChange={(checked) => updateLabel({ enabled: checked })}
          label="Label tab"
          ariaLabel="Enable label tab"
        />
        {label.enabled && (
          <input
            type="text"
            value={label.text}
            onChange={(e) => updateLabel({ text: e.target.value.slice(0, DESIGNER_CONSTRAINTS.MAX_LABEL_LENGTH) })}
            placeholder="Label text (optional)"
            maxLength={DESIGNER_CONSTRAINTS.MAX_LABEL_LENGTH}
            className="w-full rounded border border-stroke-subtle bg-surface px-2 py-1 text-xs text-content placeholder:text-content-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label="Label text"
          />
        )}
      </div>
    </div>
  );
}
