/**
 * Split-axis scoop controls for a single cutout.
 *
 * For rectangles, the panel can expand into per-axis Scoop W / Scoop D
 * sliders. Ungrouped rectangles additionally expose four edge toggles
 * (L/R/F/B in cutout-local frame); grouped rectangles hide them because
 * edges shared between members have ambiguous wall identity. Circles and
 * paths show only a single uniform slider — they have no W/D distinction.
 *
 * The "Split" toggle is UI state; the data model always stores both
 * scoopRadiusW and scoopRadiusD. Collapsing writes max(W, D) into both.
 */

import { useState } from 'react';
import type { Cutout, CutoutScoopEdges } from '@/features/bin-designer/types';
import { DEFAULT_SCOOP_EDGES } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import { SliderInput } from '@/design-system';
import { SEGMENT_ACTIVE, SEGMENT_INACTIVE } from '@/shared/components/segmentedControlClasses';

interface CutoutScoopControlsProps {
  readonly cutout: Cutout;
  readonly preview?: Partial<Cutout>;
  readonly disabled?: boolean;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
}

function getField<K extends keyof Cutout>(
  cutout: Cutout,
  preview: Partial<Cutout> | undefined,
  key: K
): Cutout[K] {
  if (preview && key in preview) return preview[key] as Cutout[K];
  return cutout[key];
}

export function CutoutScoopControls({
  cutout,
  preview,
  disabled,
  onUpdate,
}: CutoutScoopControlsProps) {
  const t = useTranslation();
  const radiusW = getField(cutout, preview, 'scoopRadiusW') ?? 0;
  const radiusD = getField(cutout, preview, 'scoopRadiusD') ?? 0;
  const edges = getField(cutout, preview, 'scoopEdges') ?? DEFAULT_SCOOP_EDGES;

  const supportsSplit = cutout.shape === 'rectangle';
  const supportsEdges = supportsSplit && cutout.groupId === null;

  // Auto-open the split panel when W and D diverge or any edge is off,
  // so a loaded design with asymmetric scoop reveals its full state.
  // Callers MUST pass `key={cutout.id}` so this initial value is re-evaluated
  // when the active cutout changes; otherwise the panel inherits the
  // previous cutout's open/closed state.
  const hasNonUniformState =
    radiusW !== radiusD || !(edges.left && edges.right && edges.front && edges.back);
  const [expanded, setExpanded] = useState(hasNonUniformState);

  const maxScoop = Math.min(cutout.cutDepth, Math.min(cutout.width, cutout.depth) / 2);
  const uniformValue = Math.max(radiusW, radiusD);

  const handleUniformChange = (value: number) => {
    onUpdate({ scoopRadiusW: value, scoopRadiusD: value });
  };

  const toggleEdge = (key: keyof CutoutScoopEdges) => {
    onUpdate({ scoopEdges: { ...edges, [key]: !edges[key] } });
  };

  if (!supportsSplit || !expanded) {
    return (
      <div className="space-y-1.5">
        <SliderInput
          label={t('binDesigner.cutouts.scoopRadius')}
          value={uniformValue}
          onChange={handleUniformChange}
          min={0}
          max={maxScoop}
          step={0.5}
          unit="mm"
          disabled={disabled}
        />
        {supportsSplit && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
            disabled={disabled}
          >
            {t('binDesigner.cutouts.scoopSplit')}
          </button>
        )}
      </div>
    );
  }

  const handleCollapse = () => {
    const merged = Math.max(radiusW, radiusD);
    onUpdate({
      scoopRadiusW: merged,
      scoopRadiusD: merged,
      scoopEdges: DEFAULT_SCOOP_EDGES,
    });
    setExpanded(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-content-tertiary">
          {t('binDesigner.cutouts.scoopRadius')}
        </span>
        <button
          type="button"
          onClick={handleCollapse}
          className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
          disabled={disabled}
        >
          {t('binDesigner.cutouts.scoopUniform')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <CompactNumberInput
          label={t('binDesigner.cutouts.scoopW')}
          value={radiusW}
          onChange={(scoopRadiusW) => onUpdate({ scoopRadiusW })}
          min={0}
          max={maxScoop}
          step={0.5}
          unit="mm"
          disabled={disabled}
        />
        <CompactNumberInput
          label={t('binDesigner.cutouts.scoopD')}
          value={radiusD}
          onChange={(scoopRadiusD) => onUpdate({ scoopRadiusD })}
          min={0}
          max={maxScoop}
          step={0.5}
          unit="mm"
          disabled={disabled}
        />
      </div>
      {supportsEdges && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-content-tertiary">
            {t('binDesigner.cutouts.scoopEdges')}
          </span>
          <EdgeChip
            label={t('binDesigner.cutouts.scoopEdgeLeft')}
            ariaLabel={t('binDesigner.cutouts.scoopEdgeLeftAria')}
            on={edges.left}
            disabled={disabled}
            onToggle={() => toggleEdge('left')}
          />
          <EdgeChip
            label={t('binDesigner.cutouts.scoopEdgeRight')}
            ariaLabel={t('binDesigner.cutouts.scoopEdgeRightAria')}
            on={edges.right}
            disabled={disabled}
            onToggle={() => toggleEdge('right')}
          />
          <EdgeChip
            label={t('binDesigner.cutouts.scoopEdgeFront')}
            ariaLabel={t('binDesigner.cutouts.scoopEdgeFrontAria')}
            on={edges.front}
            disabled={disabled}
            onToggle={() => toggleEdge('front')}
          />
          <EdgeChip
            label={t('binDesigner.cutouts.scoopEdgeBack')}
            ariaLabel={t('binDesigner.cutouts.scoopEdgeBackAria')}
            on={edges.back}
            disabled={disabled}
            onToggle={() => toggleEdge('back')}
          />
        </div>
      )}
    </div>
  );
}

interface EdgeChipProps {
  readonly label: string;
  readonly ariaLabel: string;
  readonly on: boolean;
  readonly disabled?: boolean;
  readonly onToggle: () => void;
}

function EdgeChip({ label, ariaLabel, on, disabled, onToggle }: EdgeChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={on}
      className={`h-5 min-w-[20px] rounded px-1 text-[10px] font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? SEGMENT_ACTIVE : SEGMENT_INACTIVE
      }`}
    >
      {label}
    </button>
  );
}
