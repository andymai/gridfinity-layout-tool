import type { Cutout } from '@/features/bin-designer/types';
import { CHAMFER_SHAPES, MAX_CUTOUT_CHAMFER, maxEntryChamfer } from '@/features/bin-designer/types';
import { NumberField } from '@/design-system';
import { useTranslation } from '@/i18n';
import { cutoutEntryProfile } from '@/shared/utils/cutoutFit';
import { EntryProfileToggle } from '../panel/CutoutsSection/EntryProfileToggle';

export interface BatchEntryEdgeFieldsProps {
  /** The selection, with any live preview already applied. */
  readonly cutouts: readonly Cutout[];
  readonly onUpdateBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly disabled?: boolean;
}

/**
 * The entry edge across a multi-selection, as two cells of the inspector's
 * field grid. Shapes that take no entry edge are skipped rather than blocking
 * the control for the whole selection, and each width is clamped to its own
 * cut depth's headroom.
 */
export function BatchEntryEdgeFields({
  cutouts,
  onUpdateBatch,
  disabled = false,
}: BatchEntryEdgeFieldsProps) {
  const t = useTranslation();
  const edged = cutouts.filter((c) => CHAMFER_SHAPES.includes(c.shape));
  if (edged.length === 0) return null;

  const widths = new Set(edged.map((c) => c.chamferWidth ?? 0));
  const sharedWidth = widths.size === 1 ? [...widths][0] : null;
  const profiles = new Set(edged.map(cutoutEntryProfile));
  const sharedProfile = profiles.size === 1 ? [...profiles][0] : null;
  const write = (patch: (c: Cutout) => Partial<Cutout>) =>
    onUpdateBatch(new Map(edged.map((c) => [c.id, patch(c)])));

  return (
    <>
      <div className="col-span-2">
        <EntryProfileToggle
          value={sharedProfile}
          onChange={(profile) =>
            write(() => ({ entryProfile: profile === 'chamfer' ? undefined : profile }))
          }
          disabled={disabled}
        />
      </div>
      <NumberField
        label={t(
          sharedProfile === 'round'
            ? 'binDesigner.cutouts.entryRound'
            : 'binDesigner.cutouts.chamfer'
        )}
        value={sharedWidth ?? 0}
        indeterminate={sharedWidth === null}
        onChange={(value) =>
          write((c) => ({ chamferWidth: Math.min(value, maxEntryChamfer(c.cutDepth)) }))
        }
        min={0}
        max={MAX_CUTOUT_CHAMFER}
        step={0.2}
        unit="mm"
        disabled={disabled}
      />
    </>
  );
}
