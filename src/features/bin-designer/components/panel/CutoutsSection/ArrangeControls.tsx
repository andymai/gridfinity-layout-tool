/**
 * Multi-select z-order controls: Bring Forward / Send Backward /
 * Bring to Front / Send to Back. Thin wrapper over the existing
 * `reorderCutouts` slice action — surfaces the four buttons that were
 * previously only reachable from the context menu.
 */

import type { ReorderDirection } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { getSegmentClass } from '@/shared/components/segmentedControlClasses';

interface ArrangeControlsProps {
  readonly selectedIds: readonly string[];
  readonly onReorder: (ids: readonly string[], direction: ReorderDirection) => void;
  readonly disabled?: boolean;
}

export function ArrangeControls({
  selectedIds,
  onReorder,
  disabled = false,
}: ArrangeControlsProps) {
  const t = useTranslation();
  const noSelection = selectedIds.length === 0;
  const allDisabled = disabled || noSelection;

  const btn = (direction: ReorderDirection, label: string, content: React.ReactNode) => (
    <button
      type="button"
      className={getSegmentClass(false, { size: 'icon' })}
      onClick={() => onReorder(selectedIds, direction)}
      title={label}
      aria-label={label}
      disabled={allDisabled}
    >
      {content}
    </button>
  );

  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label={t('binDesigner.cutouts.arrange.title')}
    >
      {btn(
        'front',
        t('binDesigner.cutouts.arrange.bringToFront'),
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="2" width="7" height="7" fill="currentColor" opacity="0.4" />
          <rect x="5" y="5" width="7" height="7" fill="currentColor" />
        </svg>
      )}
      {btn(
        'forward',
        t('binDesigner.cutouts.arrange.bringForward'),
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="2" width="7" height="7" />
          <rect x="5" y="5" width="7" height="7" fill="currentColor" />
        </svg>
      )}
      {btn(
        'backward',
        t('binDesigner.cutouts.arrange.sendBackward'),
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="2" width="7" height="7" fill="currentColor" />
          <rect x="5" y="5" width="7" height="7" />
        </svg>
      )}
      {btn(
        'back',
        t('binDesigner.cutouts.arrange.sendToBack'),
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="2" width="7" height="7" fill="currentColor" />
          <rect x="5" y="5" width="7" height="7" fill="currentColor" opacity="0.4" />
        </svg>
      )}
    </div>
  );
}
