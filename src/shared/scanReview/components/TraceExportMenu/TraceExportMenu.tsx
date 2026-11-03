/**
 * Export or Download for traced tools: the outlines as an SVG or DXF drawing,
 * or as an STL extruded to a thickness, saved without adding them to a bin.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, NumberField, Popover, SegmentedControl } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { primeExportFolder } from '@/shared/exportDestination/exportFolder';
import { isOk } from '@/core/result';
import type { CleanedTool } from '../../scanFlow';
import {
  DEFAULT_TRACE_THICKNESS_MM,
  SCAN_CLEARANCE_MM,
  TRACE_EXPORT_FORMATS,
  traceExportBlob,
  traceExportFileName,
  type TraceExportFormat,
} from '../../traceExport';

export interface TraceExportMenuProps {
  /** The tools to save, in millimetres; null while there are none to save yet. */
  readonly tools: readonly CleanedTool[] | null;
  readonly source: 'trace_view' | 'phone';
  /** `export` beside Add on the desktop, `download` beside Send on the phone. */
  readonly trigger: 'export' | 'download';
  readonly placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  readonly fullWidth?: boolean;
  readonly disabled?: boolean;
}

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), input:not([disabled])';

const focusables = (panel: HTMLElement | null): HTMLElement[] =>
  panel ? [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];

export function TraceExportMenu({
  tools,
  source,
  trigger,
  placement = 'top-end',
  fullWidth = false,
  disabled = false,
}: TraceExportMenuProps) {
  const t = useTranslation();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<TraceExportFormat>('svg');
  const [clearance, setClearance] = useState(false);
  const [thicknessMm, setThicknessMm] = useState(DEFAULT_TRACE_THICKNESS_MM);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Portaled to the page, the menu is outside a dialog's focus trap, so it
  // takes focus on opening, keeps Tab among its own controls, and gives
  // focus back to its button when it closes.
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const keepTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables(panel);
      if (items.length === 0) return;
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement !== edge) return;
      e.preventDefault();
      (e.shiftKey ? items[items.length - 1] : items[0]).focus();
    };
    panel.addEventListener('keydown', keepTab);
    const frame = requestAnimationFrame(() => focusables(panel)[0]?.focus());
    return () => {
      panel.removeEventListener('keydown', keepTab);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const close = () => {
    if (panelRef.current?.contains(document.activeElement)) anchorRef.current?.focus();
    setOpen(false);
  };

  const download = async () => {
    if (!tools || tools.length === 0) return;
    primeExportFolder();
    setBusy(true);
    setFailed(false);
    try {
      const built = await traceExportBlob(tools, format, { clearance, thicknessMm });
      if (!isOk(built)) {
        setFailed(true);
        return;
      }
      if (!(await deliverExport(built.value, traceExportFileName(format)))) return;
      trackEvent('trace_export', { format, clearance, tool_count: tools.length, source });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        ref={anchorRef}
        type="button"
        variant="secondary"
        fullWidth={fullWidth}
        disabled={disabled || !tools || tools.length === 0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t(`scan.export.button.${trigger}`)}
      </Button>
      <Popover
        anchorRef={anchorRef}
        isOpen={open}
        onClose={close}
        placement={placement}
        aria-label={t(`scan.export.button.${trigger}`)}
        className="w-64 p-3"
      >
        <div ref={panelRef} className="space-y-2">
          <p className="text-label leading-relaxed text-content-tertiary">
            {t('scan.export.hint')}
          </p>
          <SegmentedControl
            aria-label={t('scan.export.format')}
            options={TRACE_EXPORT_FORMATS.map((value) => ({
              value,
              label: t(`scan.export.format.${value}`),
            }))}
            value={format}
            onChange={setFormat}
            size="sm"
          />
          {format === 'stl' && (
            <NumberField
              label={t('scan.export.thickness')}
              value={thicknessMm}
              onChange={setThicknessMm}
              min={0.5}
              max={200}
              step={0.5}
              unit="mm"
              size="sm"
            />
          )}
          <Checkbox
            checked={clearance}
            onChange={setClearance}
            label={t('scan.export.clearance', { mm: SCAN_CLEARANCE_MM })}
            size="sm"
          />
          {failed && (
            <p role="alert" className="text-xs text-danger">
              {t('scan.export.failed')}
            </p>
          )}
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => void download()}
            disabled={busy}
          >
            {t(`scan.export.download.${format}`)}
          </Button>
        </div>
      </Popover>
    </>
  );
}
