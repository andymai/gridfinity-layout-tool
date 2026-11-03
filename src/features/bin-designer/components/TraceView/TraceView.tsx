import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Spinner } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { PaperSize, Point } from '@/shared/scanTrace';
import { TraceCanvas } from './TraceCanvas';
import type { TraceMode } from './traceMode';
import { ScalePanel } from './ScalePanel';
import { ToolsPanel } from './ToolsPanel';
import { OutlineCleanupControls } from '../OutlineCleanup/OutlineCleanupControls';
import { NO_CLEANUP } from '@/shared/outlineCleanup';
import { TraceExportMenu } from '@/shared/scanReview';
import { useTraceSession } from './useTraceSession';

export interface TraceViewProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The traced tools as the millimetre SVG a phone scan uploads. */
  readonly onTraced: (svg: string) => void;
}

const isImage = (file: File): boolean => file.type.startsWith('image/');

function DropZone({ onChoose }: { readonly onChoose: () => void }) {
  const t = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <svg
        className="h-12 w-12 text-content-tertiary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.75" />
        <path d="M21 16l-5-5-9 9" />
      </svg>
      <p className="text-base font-semibold text-content-primary">
        {t('binDesigner.cutouts.traceView.drop.title')}
      </p>
      <Button type="button" variant="primary" onClick={onChoose}>
        {t('binDesigner.cutouts.traceView.drop.choose')}
      </Button>
      <ul className="flex max-w-sm flex-col gap-1.5 text-left text-sm text-content-secondary">
        <li>{t('binDesigner.cutouts.traceView.drop.tipSurface')}</li>
        <li>{t('binDesigner.cutouts.traceView.drop.tipReference')}</li>
        <li>{t('binDesigner.cutouts.traceView.drop.tipManual')}</li>
      </ul>
      <p className="text-xs text-content-tertiary">{t('binDesigner.cutouts.traceView.privacy')}</p>
    </div>
  );
}

/**
 * Full-screen photo tracing on the desktop: drop in a photo, set its scale
 * from what is in frame or by hand, find and fix the tools, and add them.
 * Runs the phone's pipeline and hands back the same SVG it uploads.
 */
export function TraceView({ open, onClose, onTraced }: TraceViewProps) {
  const t = useTranslation();
  const session = useTraceSession();
  const [mode, setMode] = useState<TraceMode>('tap');
  const [marks, setMarks] = useState<readonly Point[]>([]);
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const fileInput = useRef<HTMLInputElement | null>(null);

  const leaveMode = () => {
    setMode('tap');
    setMarks([]);
  };
  const choose = (file: File | undefined) => {
    if (!file || !isImage(file)) return;
    leaveMode();
    void session.load(file);
  };
  const pick = () => fileInput.current?.click();

  // Escape leaves a marking mode before it can reach the dialog. Captured on
  // the window, since the dialog stops every key that bubbles out of it.
  const marking = mode !== 'tap';
  useEffect(() => {
    if (!marking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setMode('tap');
      setMarks([]);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [marking]);

  const { scene, photo } = session;
  const busy = session.working || session.loading;
  const count = session.shapes.length;
  const svg = mode === 'tap' ? session.traced() : null;
  const needsScale = scene !== null && scene.units !== 'mm';

  const add = () => {
    if (!svg) return;
    onTraced(svg);
    onClose();
  };

  return (
    <Dialog.Root
      open={open}
      onClose={onClose}
      size="5xl"
      fullScreen="always"
      closeOnEscape={!marking}
      closeOnOverlayClick={false}
    >
      <Dialog.Header title={t('binDesigner.cutouts.traceView.title')} bordered />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          className="relative min-h-[50vh] min-w-0 flex-1 bg-surface"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files[0]);
          }}
        >
          {session.loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-content-secondary">
              <Spinner size="md" />
              <p className="text-sm">{t('scan.processing')}</p>
            </div>
          ) : photo && scene ? (
            <TraceCanvas
              key={photo.url}
              photo={photo}
              scene={scene}
              shapes={session.shapes}
              keepHoles={session.keepHoles}
              mode={mode}
              region={session.region}
              marks={marks}
              busy={session.working}
              canRefine={session.canRefine}
              onTap={session.tap}
              onRegion={(region) => {
                setMode('tap');
                session.setRegion(region);
              }}
              onMarks={setMarks}
            />
          ) : (
            <DropZone onChoose={pick} />
          )}
          {session.failed && (
            <p
              role="alert"
              className="absolute inset-x-4 top-4 rounded-lg border border-warning bg-warning-muted px-3 py-2 text-sm text-warning"
            >
              {t('scan.error.decode')}
            </p>
          )}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-t border-stroke-subtle p-4 md:w-96 md:border-l md:border-t-0">
          {photo && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={pick}
            >
              {t('binDesigner.cutouts.traceView.photo.change')}
            </Button>
          )}
          {photo && scene && (
            <ScalePanel
              scene={scene}
              frame={photo.image}
              mode={mode}
              marks={marks}
              manual={session.manual}
              hasAuto={session.hasAuto}
              paperSize={paperSize}
              cardSize={session.cardSize}
              disabled={busy}
              onStart={(next) => {
                setMode(next);
                setMarks([]);
              }}
              onCancel={leaveMode}
              onPaperSize={setPaperSize}
              onApply={(reference) => {
                leaveMode();
                session.setScale(reference);
              }}
              onClear={() => session.setScale(null)}
              onCardSize={session.setCardSize}
            />
          )}
          {scene && (
            <ToolsPanel
              shapes={session.shapes}
              units={scene.units}
              drawingRegion={mode === 'region'}
              hasRegion={session.region !== null}
              sensitivity={session.sensitivity}
              holesFound={session.holesFound}
              keepHoles={session.keepHoles}
              canRefine={session.canRefine}
              canUndo={session.canUndo}
              disabled={busy}
              onDrawRegion={() => {
                setMarks([]);
                setMode(mode === 'region' ? 'tap' : 'region');
              }}
              onClearRegion={() => session.setRegion(null)}
              onSensitivity={session.setSensitivity}
              onCommitSensitivity={session.commitSensitivity}
              onKeepHoles={session.setKeepHoles}
              onRemove={session.remove}
              onUndo={session.undo}
            />
          )}
          {session.cleanup.available && count > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-content-primary">
                {t('binDesigner.cutouts.traceView.cleanup.heading')}
              </h3>
              {!session.cleanup.canMirror && (
                <p className="text-xs text-content-tertiary">
                  {t('binDesigner.cutouts.traceView.cleanup.hint')}
                </p>
              )}
              <OutlineCleanupControls
                settings={session.cleanup.settings}
                onChange={session.cleanup.set}
                onReset={() => session.cleanup.set(NO_CLEANUP, true)}
                yDown
                upright={session.cleanup.upright}
                canMirror={session.cleanup.canMirror}
                squareTo="photo"
                disabled={busy}
              />
            </section>
          )}
        </aside>
      </div>
      <Dialog.Footer
        bordered
        leading={
          needsScale ? (
            <span className="text-xs text-content-secondary">
              {t('binDesigner.cutouts.traceView.needsScale')}
            </span>
          ) : undefined
        }
      >
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <TraceExportMenu
          tools={mode === 'tap' ? session.exportTools : null}
          source="trace_view"
          trigger="export"
        />
        <Button type="button" variant="primary" disabled={svg === null} onClick={add}>
          {count > 1
            ? t('binDesigner.cutouts.traceView.addMany', { count })
            : t('binDesigner.cutouts.scanImport.add')}
        </Button>
      </Dialog.Footer>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </Dialog.Root>
  );
}
