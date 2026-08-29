/**
 * Align and distribute button row for a multi-cutout selection.
 *
 * Sits above the shared numeric fields in the inspector, so every multi-select
 * action lives in one place. Distribute needs a shape at each end plus one to
 * place between them, so its buttons stay disabled below three.
 */

import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalDistributeCenterIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalDistributeCenterIcon,
} from '@/design-system/Icon';
import { IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { AlignMode, DistributeAxis } from '../panel/CutoutsSection/geometryAlign';

/** Distribute is meaningless until something sits between the two extremes. */
const MIN_DISTRIBUTE_COUNT = 3;

interface AlignControlsProps {
  readonly selectedCount: number;
  readonly onAlign: (mode: AlignMode) => void;
  readonly onDistribute: (axis: DistributeAxis) => void;
  readonly disabled?: boolean;
}

export function AlignControls({
  selectedCount,
  onAlign,
  onDistribute,
  disabled = false,
}: AlignControlsProps) {
  const t = useTranslation();

  const alignButtons: ReadonlyArray<{
    mode: AlignMode;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      mode: 'left',
      label: t('binDesigner.cutouts.align.left'),
      icon: <AlignStartVerticalIcon size="xs" />,
    },
    {
      mode: 'centerX',
      label: t('binDesigner.cutouts.align.centerX'),
      icon: <AlignCenterVerticalIcon size="xs" />,
    },
    {
      mode: 'right',
      label: t('binDesigner.cutouts.align.right'),
      icon: <AlignEndVerticalIcon size="xs" />,
    },
    {
      mode: 'top',
      label: t('binDesigner.cutouts.align.top'),
      icon: <AlignStartHorizontalIcon size="xs" />,
    },
    {
      mode: 'middleY',
      label: t('binDesigner.cutouts.align.middleY'),
      icon: <AlignCenterHorizontalIcon size="xs" />,
    },
    {
      mode: 'bottom',
      label: t('binDesigner.cutouts.align.bottom'),
      icon: <AlignEndHorizontalIcon size="xs" />,
    },
  ];

  const canDistribute = !disabled && selectedCount >= MIN_DISTRIBUTE_COUNT;

  return (
    <div className="space-y-1.5">
      <div>
        <span className="mb-1 block text-micro font-medium uppercase tracking-wide text-content-tertiary">
          {t('binDesigner.cutouts.align.title')}
        </span>
        <div className="flex gap-0.5">
          {alignButtons.map(({ mode, label, icon }) => (
            <IconButton
              key={mode}
              type="button"
              size="sm"
              variant="ghost"
              aria-label={label}
              title={label}
              disabled={disabled}
              onClick={() => onAlign(mode)}
            >
              {icon}
            </IconButton>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1 block text-micro font-medium uppercase tracking-wide text-content-tertiary">
          {t('binDesigner.cutouts.distribute.title')}
        </span>
        <div className="flex gap-0.5">
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('binDesigner.cutouts.distribute.horizontal')}
            title={t('binDesigner.cutouts.distribute.horizontal')}
            disabled={!canDistribute}
            onClick={() => onDistribute('horizontal')}
          >
            <AlignHorizontalDistributeCenterIcon size="xs" />
          </IconButton>
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('binDesigner.cutouts.distribute.vertical')}
            title={t('binDesigner.cutouts.distribute.vertical')}
            disabled={!canDistribute}
            onClick={() => onDistribute('vertical')}
          >
            <AlignVerticalDistributeCenterIcon size="xs" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
