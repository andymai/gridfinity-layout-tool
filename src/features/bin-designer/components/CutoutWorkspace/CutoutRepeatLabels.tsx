/**
 * Per-copy labels for a repeat: one line per hole, in the order
 * {@link arrayLabelOrder} states.
 *
 * A textarea rather than one input per copy, because the lists this is for are
 * pasted (a column of bit names out of a spreadsheet) and a repeat can run to
 * dozens of holes. What a field-per-copy editor would buy, namely no ordering
 * to infer, is bought instead by the 2D canvas: it draws each label on its own
 * hole as soon as it is typed.
 *
 * Rendered only for an engraved repeat. A socket-mode repeat gets ONE plate
 * spanning the whole pattern (`cutoutSocketAnchorAabb`), so there is no
 * per-copy label to write.
 */

import { useId } from 'react';
import type { Cutout, CutoutArrayConfig } from '@/features/bin-designer/types';
import { TEXT_MAX_LENGTH } from '@/features/bin-designer/types';
import { arrayInstanceCount, arrayLabelCounts, arrayLabelOrder } from '@/shared/utils/cutoutArray';
import { useTranslation } from '@/i18n';
import { Button, Textarea } from '@/design-system';

interface CutoutRepeatLabelsProps {
  readonly cutout: Cutout;
  readonly disabled?: boolean;
  /**
   * Writes the whole repeat, not a cutout patch. A grouped cutout shares ONE
   * config with its siblings, and this panel is reachable for a single member
   * (the shape list lists an expanded group's members as their own rows), so
   * patching just this cutout would leave the group holding two different
   * repeats.
   */
  readonly onChange: (config: CutoutArrayConfig) => void;
}

const ACTION_CLASS =
  'flex-1 rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-label text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50';

/**
 * Rows the list is edited as. Blank lines are NOT dropped: a blank line inside
 * the list is a deliberately bare hole, and removing it would shift every label
 * below it onto the wrong one.
 */
const toLines = (labels: readonly string[]): string => labels.join('\n');

const fromLines = (text: string): string[] =>
  text.split('\n').map((line) => line.slice(0, TEXT_MAX_LENGTH));

/**
 * True when the list looks like the comma-separated form ("Upcut, Downcut,
 * Compression") rather than the line-per-hole one.
 *
 * Offered as an action instead of being applied automatically, because a comma
 * is legal inside a label. "1/4in, long" is one hole, not two, and nothing here
 * can tell the two apart by looking.
 */
function looksCommaSeparated(labels: readonly string[], copies: number): boolean {
  const written = labels.filter((l) => l.trim() !== '');
  return copies > 1 && written.length === 1 && written[0].includes(',');
}

const splitOnCommas = (labels: readonly string[]): string[] =>
  labels
    .join('\n')
    .split(/[\n,]/)
    .map((part) => part.trim().slice(0, TEXT_MAX_LENGTH))
    .filter((part, i, all) => part !== '' || i < all.length - 1);

export function CutoutRepeatLabels({
  cutout,
  disabled = false,
  onChange,
}: CutoutRepeatLabelsProps) {
  const t = useTranslation();
  const hintId = useId();
  const array = cutout.array;
  if (!array) return null;

  const setLabels = (labels: string[] | undefined): void => {
    onChange({ ...array, labels });
  };

  // Absent list = the repeat is labelled once, beside the master, which is what
  // every design stored before this control existed prints. Seeding one line
  // per copy (rather than an empty box) makes the pattern's size legible: five
  // lines means five holes to name.
  if (array.labels === undefined) {
    return (
      <Button
        type="button"
        variant="ghost"
        className={`w-full ${ACTION_CLASS}`}
        onClick={() => setLabels(Array<string>(arrayInstanceCount(array)).fill(cutout.label))}
        disabled={disabled}
      >
        {t('binDesigner.cutouts.repeat.labels.enable')}
      </Button>
    );
  }

  const labels = array.labels;
  const counts = arrayLabelCounts(array);
  const short = counts.labels < counts.copies;
  const long = counts.labels > counts.copies;

  return (
    <div className="space-y-1">
      <span className="text-micro text-text-muted">
        {t('binDesigner.cutouts.repeat.labels.title')}
      </span>
      <Textarea
        rows={Math.min(8, Math.max(3, labels.length))}
        resize="vertical"
        className="text-xs"
        value={toLines(labels)}
        onChange={(e) => setLabels(fromLines(e.target.value))}
        disabled={disabled}
        aria-label={t('binDesigner.cutouts.repeat.labels.title')}
        aria-describedby={hintId}
        placeholder={t('binDesigner.cutouts.repeat.labels.placeholder')}
      />
      <p id={hintId} className="text-micro leading-snug text-content-tertiary">
        {t(`binDesigner.cutouts.repeat.labels.order.${arrayLabelOrder(array)}`)}
      </p>
      {/* Advisory, never a block: the request asks for a mismatch to be
          reported rather than refused, and both directions are legitimate
          states to be in halfway through typing.

          The tally and its explanation are whole sentences on their own lines
          rather than one line joined by punctuation, so no locale has to
          inherit English's clause order to read correctly. */}
      <p
        className={`text-label leading-snug ${short || long ? 'text-warning' : 'text-content-tertiary'}`}
      >
        {t('binDesigner.cutouts.repeat.labels.count', {
          labels: counts.labels,
          copies: counts.copies,
        })}
      </p>
      {short && (
        <p className="text-label leading-snug text-content-tertiary">
          {t('binDesigner.cutouts.repeat.labels.short', { count: counts.copies - counts.labels })}
        </p>
      )}
      {long && (
        <p className="text-label leading-snug text-content-tertiary">
          {t('binDesigner.cutouts.repeat.labels.long', { count: counts.labels - counts.copies })}
        </p>
      )}
      <div className="flex gap-1.5">
        {looksCommaSeparated(labels, counts.copies) && (
          <Button
            type="button"
            variant="ghost"
            className={ACTION_CLASS}
            onClick={() => setLabels(splitOnCommas(labels))}
            disabled={disabled}
          >
            {t('binDesigner.cutouts.repeat.labels.splitCommas')}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className={ACTION_CLASS}
          onClick={() => setLabels(undefined)}
          disabled={disabled}
        >
          {t('binDesigner.cutouts.repeat.labels.disable')}
        </Button>
      </div>
    </div>
  );
}
