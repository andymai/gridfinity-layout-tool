/**
 * Canvas-corner chrome: camera presets (matching the bin preview's 1–4
 * shortcuts), zoom-to-selection, the projection toggle, and the snap-pitch
 * cycle chip, the cutout toolbar's widget.
 */
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Projection } from '@/shared/components/preview/CameraRig';
import type { CameraPreset } from '../preview';
import { SNAP_PITCHES_MM } from './workshopPlacement';

const PRESETS: ReadonlyArray<{ preset: CameraPreset; labelKey: string; shortcut: string }> = [
  { preset: 'front', labelKey: 'workshop.view.front', shortcut: '1' },
  { preset: 'side', labelKey: 'workshop.view.side', shortcut: '2' },
  { preset: 'top', labelKey: 'workshop.view.top', shortcut: '3' },
  { preset: 'isometric', labelKey: 'workshop.view.isometric', shortcut: '4' },
];

interface WorkshopViewBarProps {
  readonly onPreset: (preset: CameraPreset) => void;
  readonly onFit: () => void;
  readonly projection: Projection;
  readonly onProjectionToggle: () => void;
}

export function WorkshopViewBar({
  onPreset,
  onFit,
  projection,
  onProjectionToggle,
}: WorkshopViewBarProps) {
  const t = useTranslation();
  const snapMm = useDesignerStore((s) => s.ui.workshopSnapMm);
  const setWorkshopSnapMm = useDesignerStore((s) => s.setWorkshopSnapMm);
  const cycleSnap = (): void => {
    const index = SNAP_PITCHES_MM.findIndex((pitch) => pitch === snapMm);
    setWorkshopSnapMm(SNAP_PITCHES_MM[(index + 1) % SNAP_PITCHES_MM.length]);
  };
  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-stroke-subtle bg-surface-elevated/90 p-1 shadow-sm backdrop-blur">
      {PRESETS.map(({ preset, labelKey, shortcut }) => (
        <Button
          key={preset}
          variant="ghost"
          size="sm"
          className="px-2 text-label"
          title={`${t(labelKey)} (${shortcut})`}
          onClick={() => onPreset(preset)}
        >
          {t(labelKey)}
        </Button>
      ))}
      <div className="mx-0.5 h-4 w-px bg-stroke-subtle" />
      <Button
        variant="ghost"
        size="sm"
        className="px-2 text-label"
        title={t('workshop.view.fitTitle')}
        onClick={onFit}
      >
        {t('workshop.view.fit')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="px-2 text-label"
        title={t('workshop.view.projectionToggle')}
        onClick={onProjectionToggle}
      >
        {projection === 'perspective'
          ? t('workshop.view.perspective')
          : t('workshop.view.orthographic')}
      </Button>
      <div className="mx-0.5 h-4 w-px bg-stroke-subtle" />
      <Button
        variant="ghost"
        size="sm"
        className="px-2 font-mono text-label text-content-secondary"
        title={t('workshop.snap.cycle')}
        onClick={cycleSnap}
      >
        {snapMm}mm
      </Button>
    </div>
  );
}
