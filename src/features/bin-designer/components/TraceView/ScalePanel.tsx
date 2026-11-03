import { useEffect, useId, useRef, useState } from 'react';
import { Button, Input, SegmentedControl } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { CardSizeEditor, type CardSizeMm } from '@/shared/scanReview';
import {
  cardPerspectiveSkew,
  PAPER_SIZES,
  paperReference,
  rulerReference,
  STEEP_CARD_SKEW,
  type PaperSize,
  type Point,
  type SceneReference,
  type SceneTrace,
} from '@/shared/scanTrace';
import type { TraceMode } from './traceMode';

interface ScalePanelProps {
  readonly scene: SceneTrace;
  /** The photo's size, for telling a tilted sheet's long side from its short one. */
  readonly frame: { readonly width: number; readonly height: number };
  readonly mode: TraceMode;
  readonly marks: readonly Point[];
  readonly manual: boolean;
  /** The photo has a reference of its own to go back to. */
  readonly hasAuto: boolean;
  readonly paperSize: PaperSize;
  readonly cardSize: CardSizeMm;
  readonly disabled: boolean;
  readonly onStart: (mode: 'ruler' | 'paper') => void;
  readonly onCancel: () => void;
  readonly onPaperSize: (size: PaperSize) => void;
  readonly onApply: (reference: SceneReference) => void;
  readonly onClear: () => void;
  readonly onCardSize: (size: CardSizeMm) => void;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * A typed length in millimetres, or NaN while it is not one. A text field, not
 * a number one, so a decimal comma reaches here instead of being dropped.
 */
const parseMm = (text: string): number =>
  text.trim() === '' ? Number.NaN : Number(text.trim().replace(',', '.'));

function Measured({ scene }: { readonly scene: SceneTrace }) {
  const t = useTranslation();
  const reference = scene.reference;
  const lines: { readonly text: string; readonly tone: string }[] = [];
  switch (reference?.kind) {
    case 'card':
      lines.push({ text: t('scan.cardMeasured'), tone: 'text-success' });
      if (scene.card && cardPerspectiveSkew(scene.card.corners) > STEEP_CARD_SKEW) {
        lines.push({ text: t('scan.cardSteepAngle'), tone: 'text-warning' });
      }
      break;
    case 'sheet':
    case 'baseplate': {
      const sheet = reference.kind === 'sheet';
      lines.push({
        text: t(sheet ? 'scan.gridMeasured' : 'scan.baseplateMeasured'),
        tone: 'text-success',
      });
      lines.push({
        text: t(sheet ? 'scan.gridDetail' : 'scan.baseplateDetail', {
          count: reference.fit.cells.length,
          rms: round1(reference.fit.rmsMm),
        }),
        tone: 'text-content-secondary',
      });
      if (!sheet)
        lines.push({ text: t('scan.baseplateAccuracyHint'), tone: 'text-content-tertiary' });
      break;
    }
    case 'ruler':
      lines.push({
        text: t('binDesigner.cutouts.traceView.scale.ruler', { length: reference.ruler.lengthMm }),
        tone: 'text-success',
      });
      break;
    case 'paper':
      lines.push({
        text: t(
          Math.max(reference.paper.widthMm, reference.paper.heightMm) === PAPER_SIZES.a4.longMm
            ? 'binDesigner.cutouts.traceView.scale.paperA4'
            : 'binDesigner.cutouts.traceView.scale.paperLetter'
        ),
        tone: 'text-success',
      });
      break;
    default:
      break;
  }
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-success/40 bg-success/10 px-3 py-2">
      {lines.map((line, i) => (
        <p key={i} className={`text-xs ${line.tone}`}>
          {line.text}
        </p>
      ))}
    </div>
  );
}

export function ScalePanel({
  scene,
  frame,
  mode,
  marks,
  manual,
  hasAuto,
  paperSize,
  cardSize,
  disabled,
  onStart,
  onCancel,
  onPaperSize,
  onApply,
  onClear,
  onCardSize,
}: ScalePanelProps) {
  const t = useTranslation();
  const fieldId = useId();
  const [lengthText, setLengthText] = useState('');
  const lengthField = useRef<HTMLInputElement | null>(null);
  // The second click finishes the ruler; the length is what is asked next.
  const rulerDrawn = mode === 'ruler' && marks.length === 2;
  useEffect(() => {
    if (rulerDrawn) lengthField.current?.focus();
  }, [rulerDrawn]);
  const sized = scene.units === 'mm';

  const ruler = marks.length === 2 ? rulerReference(marks[0], marks[1], parseMm(lengthText)) : null;
  const sheet = marks.length === 4 ? paperReference(marks, paperSize, frame) : null;
  const paper = sheet && isOk(sheet) ? sheet.value : null;
  const paperProblem = sheet && !isOk(sheet) ? sheet.error : null;

  const start = (next: 'ruler' | 'paper') => {
    setLengthText('');
    onStart(next);
  };

  return (
    <section className="flex flex-col gap-2" aria-labelledby={`${fieldId}-heading`}>
      <h3 id={`${fieldId}-heading`} className="text-sm font-semibold text-content-primary">
        {t('binDesigner.cutouts.traceView.scale.heading')}
      </h3>

      {mode === 'ruler' ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-content-secondary">
            {t('binDesigner.cutouts.traceView.ruler.hint')}
          </p>
          {marks.length === 2 && (
            <div className="flex flex-col gap-1">
              <label htmlFor={fieldId} className="text-xs font-medium text-content-primary">
                {t('binDesigner.cutouts.traceView.ruler.length')}
              </label>
              <Input
                id={fieldId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                size="sm"
                ref={lengthField}
                value={lengthText}
                error={lengthText !== '' && ruler === null}
                onChange={(e) => setLengthText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && ruler) onApply(ruler);
                }}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={ruler === null}
              onClick={() => ruler && onApply(ruler)}
            >
              {t('binDesigner.cutouts.traceView.apply')}
            </Button>
          </div>
        </div>
      ) : mode === 'paper' ? (
        <div className="flex flex-col gap-2">
          <SegmentedControl
            aria-label={t('binDesigner.cutouts.traceView.paper.size')}
            size="sm"
            value={paperSize}
            onChange={onPaperSize}
            options={[
              { value: 'a4', label: t('binDesigner.cutouts.traceView.paper.a4') },
              { value: 'letter', label: t('binDesigner.cutouts.traceView.paper.letter') },
            ]}
          />
          <p className="text-xs text-content-secondary">
            {t('binDesigner.cutouts.traceView.paper.hint')}
          </p>
          <p className="text-xs text-content-tertiary">
            {t('binDesigner.cutouts.traceView.paper.count', { count: marks.length })}
          </p>
          {paperProblem && (
            <p className="text-xs text-warning">
              {t(
                paperProblem === 'tooSteep'
                  ? 'binDesigner.cutouts.traceView.paper.tooSteep'
                  : 'binDesigner.cutouts.traceView.paper.invalid'
              )}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={paper === null}
              onClick={() => paper && onApply(paper)}
            >
              {t('binDesigner.cutouts.traceView.apply')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {sized ? (
            <Measured scene={scene} />
          ) : (
            <div className="flex flex-col gap-0.5 rounded-lg border border-warning bg-warning-muted px-3 py-2">
              <p className="text-sm font-semibold text-warning">
                {t('binDesigner.cutouts.traceView.scale.none')}
              </p>
              <p className="text-xs text-content-secondary">
                {t('binDesigner.cutouts.traceView.scale.noneHint')}
              </p>
            </div>
          )}
          {scene.reference?.kind === 'card' && (
            <CardSizeEditor size={cardSize} onChange={onCardSize} />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => start('ruler')}
            >
              {t('binDesigner.cutouts.traceView.scale.drawRuler')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => start('paper')}
            >
              {t('binDesigner.cutouts.traceView.scale.markPaper')}
            </Button>
            {manual && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClear}>
                {t(
                  hasAuto
                    ? 'binDesigner.cutouts.traceView.scale.usePhoto'
                    : 'binDesigner.cutouts.traceView.scale.clear'
                )}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
