/**
 * Touch (tablet/mobile) form of the right inspector: a floating trigger plus a
 * bottom sheet, instead of the desktop side column. A right-side overlay would
 * collide with the landscape ParameterPanel (which docks on the right), so the
 * inspector is a sheet on every touch layout.
 *
 * Opened by the trigger only (not auto-opened on selection): on touch the
 * inline editors stay visible, so popping the sheet on every selection would
 * double up the editor and intrude over the canvas.
 */

import { useState } from 'react';
import { Button } from '@/design-system';
import { BottomSheet } from '@/shell/Mobile/BottomSheet/BottomSheet';
import { useTranslation } from '@/i18n';
import { RightInspectorBody } from './RightInspectorBody';
import { useRightInspectorVisible } from './useRightInspectorVisible';

export function RightInspectorSheet() {
  const t = useTranslation();
  const visible = useRightInspectorVisible();
  const [open, setOpen] = useState(false);

  if (!visible) return null;

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-30 rounded-full shadow-elevated"
        aria-label={t('binDesigner.inspector.expand')}
      >
        {t('binDesigner.inspector.title')}
      </Button>
      {open && (
        <BottomSheet
          title={t('binDesigner.inspector.title')}
          open={open}
          onClose={() => setOpen(false)}
        >
          <RightInspectorBody />
        </BottomSheet>
      )}
    </>
  );
}
