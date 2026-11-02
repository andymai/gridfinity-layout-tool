/**
 * "Export shadow board": the bin's footprint and openings as flat outlines,
 * for cutting a matching board, foam insert or drawer liner.
 */

import { useRef, useState } from 'react';
import { Button, Checkbox, Popover, SegmentedControl } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  SHADOW_BOARD_FORMATS,
  useShadowBoardExport,
  type ShadowBoardFormat,
} from '../panel/CutoutsSection/shadowBoard';

export function ShadowBoardButton() {
  const t = useTranslation();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShadowBoardFormat>('svg');
  const [clearance, setClearance] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasOpenings = useDesignerStore((s) =>
    s.params.cutouts.some((c) => c.hidden !== true && c.shape !== 'text')
  );
  const exportShadowBoard = useShadowBoardExport();

  const download = async () => {
    setBusy(true);
    try {
      if ((await exportShadowBoard(format, clearance)).ok) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        ref={anchorRef}
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => setOpen((v) => !v)}
        disabled={!hasOpenings}
        aria-expanded={open}
      >
        {t('binDesigner.shadowBoard.button')}
      </Button>
      <Popover
        anchorRef={anchorRef}
        isOpen={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        aria-label={t('binDesigner.shadowBoard.button')}
        className="w-64 space-y-2 p-3"
      >
        <p className="text-label leading-relaxed text-content-tertiary">
          {t('binDesigner.shadowBoard.hint')}
        </p>
        <SegmentedControl
          aria-label={t('binDesigner.shadowBoard.format')}
          options={SHADOW_BOARD_FORMATS.map((value) => ({
            value,
            label: t(`binDesigner.shadowBoard.format.${value}`),
          }))}
          value={format}
          onChange={setFormat}
          size="sm"
        />
        <Checkbox
          checked={clearance}
          onChange={setClearance}
          label={t('binDesigner.shadowBoard.clearance')}
          size="sm"
        />
        <Button variant="primary" size="sm" fullWidth onClick={download} disabled={busy}>
          {t(`binDesigner.shadowBoard.download.${format}`)}
        </Button>
      </Popover>
    </>
  );
}
