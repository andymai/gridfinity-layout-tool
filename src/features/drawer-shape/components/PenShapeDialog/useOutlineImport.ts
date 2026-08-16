/**
 * File import for the pen editor: SVG or DXF measured in CAD → a sketch.
 *
 * The parsers load through a dynamic `import()` rather than a static one.
 * `DrawerShapeSection` is pulled in eagerly by both the sidebar and the mobile
 * settings sheet, so a static import would put an SVG path parser and a DXF
 * reader in the eager bundle for every visitor who never imports a file.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OutlineVertex } from '@/core/types';
import { CONSTRAINTS, snapToHalf } from '@/core/constants';
import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import type { OutlineImportErrorCode } from '../../utils/outlineImport';

const ERROR_TOAST_KEYS: Record<OutlineImportErrorCode, string> = {
  PARSE_FAILED: 'toast.outlineImport.parseFailed',
  NO_CLOSED_LOOP: 'toast.outlineImport.noClosedLoop',
  TOO_MANY_VERTICES: 'toast.outlineImport.tooComplex',
  TOO_SMALL: 'toast.outlineImport.tooSmall',
  FILE_TOO_LARGE: 'toast.outlineImport.fileTooLarge',
  BINARY_DXF: 'toast.outlineImport.binaryDxf',
  UNSUPPORTED: 'toast.outlineImport.unsupported',
};

/** A perimeter that does not fit the drawer at the size it was measured. */
export interface OversizePrompt {
  readonly sourceWidthMm: number;
  readonly sourceDepthMm: number;
  readonly requiredWidthUnits: number;
  readonly requiredDepthUnits: number;
  /** False when the drawer would have to exceed the grid maximum to hold it. */
  readonly canGrow: boolean;
}

export interface OutlineImportDeps {
  readonly drawerWidthMm: number;
  readonly drawerDepthMm: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
  /** Replace the sketch with an imported perimeter. */
  readonly onImported: (vertices: OutlineVertex[]) => void;
  /** Resize the drawer so a measured perimeter fits without being scaled. */
  readonly onGrowDrawer: (widthUnits: number, depthUnits: number) => void;
}

export interface UseOutlineImportReturn {
  readonly triggerImport: () => void;
  /** Non-null while waiting for the user to choose how to handle an oversize file. */
  readonly oversize: OversizePrompt | null;
  readonly resolveOversize: (choice: 'scale' | 'grow' | 'cancel') => void;
}

/** How the perimeter should be made to fit. */
type FitMode = { kind: 'trueScale' } | { kind: 'scaleToFit' } | { kind: 'grow' };

export function useOutlineImport(deps: OutlineImportDeps): UseOutlineImportReturn {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [oversize, setOversize] = useState<OversizePrompt | null>(null);
  // The file text is held so the user's choice can be re-run against it without
  // asking them to pick the file a second time.
  const pendingRef = useRef<{ text: string; name: string } | null>(null);

  // Held in refs, synced after commit, so the DOM listener and the async import
  // never close over a stale drawer size or a stale locale.
  const depsRef = useRef(deps);
  const tRef = useRef(t);
  const runRef = useRef<(text: string, name: string, mode: FitMode) => Promise<void>>(() =>
    Promise.resolve()
  );

  const run = useCallback(
    async (text: string, name: string, mode: FitMode): Promise<void> => {
      const { importOutline } = await import('../../utils/outlineImport');
      const d = depsRef.current;
      const tr = tRef.current;
      const common = { gridUnitMm: d.gridUnitMm, gridUnitMmY: d.gridUnitMmY };

      // Measure first, at true scale against the current drawer, so the sizes
      // the prompt reports are the file's own.
      const measured = importOutline(text, {
        ...common,
        drawerWidthMm: d.drawerWidthMm,
        drawerDepthMm: d.drawerDepthMm,
        scaleToFit: false,
      });
      if (!isOk(measured)) {
        addToast(tr(ERROR_TOAST_KEYS[measured.error.code]), 'error');
        trackEvent('drawer_outline_import', { success: false, error_code: measured.error.code });
        return;
      }
      const m = measured.value;

      // Growing never shrinks the other axis: `updateDrawer` clamps a shrink
      // while a custom outline is active, so promising the file's
      // absolute dims would land a different drawer than the loop was fitted
      // and centred for. Max against the current drawer so the prompt, the
      // fit extent, and the landed size all agree.
      const currentWidthUnits = snapToHalf(d.drawerWidthMm / d.gridUnitMm);
      const currentDepthUnits = snapToHalf(d.drawerDepthMm / d.gridUnitMmY);
      const growWidthUnits = Math.max(currentWidthUnits, m.requiredWidthUnits);
      const growDepthUnits = Math.max(currentDepthUnits, m.requiredDepthUnits);

      if (mode.kind === 'trueScale' && !m.fitsAtTrueScale) {
        // A measured drawer must not be silently rescaled, so the choice
        // between shrinking the shape and growing the drawer is the user's.
        pendingRef.current = { text, name };
        setOversize({
          sourceWidthMm: m.sourceWidthMm,
          sourceDepthMm: m.sourceDepthMm,
          requiredWidthUnits: growWidthUnits,
          requiredDepthUnits: growDepthUnits,
          canGrow: growWidthUnits <= CONSTRAINTS.GRID_MAX && growDepthUnits <= CONSTRAINTS.GRID_MAX,
        });
        return;
      }

      // Growing fits the loop against the drawer it is ABOUT to have, rather
      // than re-reading the store after the resize — the outline and the resize
      // then land in the same commit instead of racing it.
      let final = m;
      if (mode.kind === 'grow') {
        const grown = importOutline(text, {
          ...common,
          drawerWidthMm: growWidthUnits * d.gridUnitMm,
          drawerDepthMm: growDepthUnits * d.gridUnitMmY,
          scaleToFit: false,
        });
        if (!isOk(grown)) return;
        final = grown.value;
        d.onGrowDrawer(growWidthUnits, growDepthUnits);
      } else if (mode.kind === 'scaleToFit') {
        const scaled = importOutline(text, {
          ...common,
          drawerWidthMm: d.drawerWidthMm,
          drawerDepthMm: d.drawerDepthMm,
          scaleToFit: true,
        });
        if (!isOk(scaled)) return;
        final = scaled.value;
      }

      d.onImported(final.vertices);
      if (final.droppedLoops > 0) {
        addToast(tr('toast.outlineImport.droppedLoops', { count: final.droppedLoops }), 'info');
      }
      if (final.simplifiedAway > 0) {
        addToast(tr('toast.outlineImport.simplified', { count: final.simplifiedAway }), 'info');
      }
      trackEvent('drawer_outline_import', {
        success: true,
        // Detected from the content, not from what the file was named.
        format: final.format,
        vertex_count: final.vertices.length,
        fit_mode: mode.kind,
        dropped_loops: final.droppedLoops,
        simplified_away: final.simplifiedAway,
      });
    },
    [addToast]
  );

  // Synced after commit rather than during render: the picker listener and the
  // async import both run later, so they see the latest values either way.
  useEffect(() => {
    depsRef.current = deps;
    tRef.current = t;
    runRef.current = run;
  });

  const resolveOversize = useCallback((choice: 'scale' | 'grow' | 'cancel') => {
    const pending = pendingRef.current;
    setOversize(null);
    pendingRef.current = null;
    if (pending === null || choice === 'cancel') return;
    void runRef.current(pending.text, pending.name, {
      kind: choice === 'scale' ? 'scaleToFit' : 'grow',
    });
  }, []);

  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,.dxf';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      // Reset first, so picking the same file again still fires a change event.
      input.value = '';
      if (file === undefined) return;
      void (async () => {
        const { MAX_OUTLINE_FILE_SIZE } = await import('../../utils/outlineImport');
        if (file.size > MAX_OUTLINE_FILE_SIZE) {
          addToast(tRef.current(ERROR_TOAST_KEYS.FILE_TOO_LARGE), 'error');
          trackEvent('drawer_outline_import', { success: false, error_code: 'FILE_TOO_LARGE' });
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const raw = reader.result;
          if (typeof raw !== 'string') return;
          void runRef.current(raw, file.name, { kind: 'trueScale' });
        };
        reader.onerror = () => {
          addToast(tRef.current(ERROR_TOAST_KEYS.PARSE_FAILED), 'error');
          trackEvent('drawer_outline_import', { success: false, error_code: 'FILE_READ_ERROR' });
        };
        reader.readAsText(file);
      })();
    });
    document.body.appendChild(input);
    inputRef.current = input;
    return () => {
      input.remove();
      inputRef.current = null;
    };
  }, [addToast]);

  const triggerImport = useCallback(() => inputRef.current?.click(), []);

  return { triggerImport, oversize, resolveOversize };
}
