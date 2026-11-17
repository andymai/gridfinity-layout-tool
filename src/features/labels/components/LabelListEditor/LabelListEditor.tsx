import { memo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, IconButton, Input, Stepper, Textarea, XIcon } from '@/design-system';
import { FieldLabel } from '@/shared/components/PanelText';
import { useTranslation } from '@/i18n';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import {
  LABEL_COPIES_MAX,
  LABEL_DETAIL_MAX_LENGTH,
  LABEL_LIST_MAX,
  LABEL_NAME_MAX_LENGTH,
  useLabelListStore,
} from '../../store/labelListStore';
import type { LabelEntry } from '../../store/labelListStore';
import { parseLabelList } from '../../utils/parseLabelList';
import type { LabelPlan } from '../../utils/planLabel';
import { LabelPreview } from '../LabelPreview';

interface LabelListEditorProps {
  readonly plans: ReadonlyMap<string, LabelPlan>;
  readonly measurer: TypeMeasurer | null;
}

export function LabelListEditor({ plans, measurer }: LabelListEditorProps) {
  const t = useTranslation();
  const { entries, addEntries } = useLabelListStore(
    useShallow((state) => ({ entries: state.entries, addEntries: state.addEntries }))
  );
  const [draft, setDraft] = useState('');
  const [listFull, setListFull] = useState(false);

  const addDraft = (): void => {
    const rows = parseLabelList(draft);
    if (rows.length === 0) return;
    // All or nothing, so the draft never holds rows that are already in the list.
    if (rows.length > LABEL_LIST_MAX - entries.length) {
      setListFull(true);
      return;
    }
    addEntries(rows);
    setListFull(false);
    setDraft('');
  };

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>{t('labels.paste')}</FieldLabel>
        <Textarea
          rows={3}
          value={draft}
          aria-label={t('labels.paste')}
          placeholder={t('labels.paste.placeholder')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              addDraft();
            }
          }}
        />
        <div className="mt-2 flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={addDraft} disabled={draft.trim() === ''}>
            {t('labels.paste.add')}
          </Button>
          {listFull && (
            <span role="status" className="text-xs text-warning">
              {t('labels.paste.full', { max: LABEL_LIST_MAX })}
            </span>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-content-tertiary">{t('labels.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <LabelRow key={entry.id} entry={entry} plan={plans.get(entry.id)} measurer={measurer} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface LabelRowProps {
  readonly entry: LabelEntry;
  readonly plan: LabelPlan | undefined;
  readonly measurer: TypeMeasurer | null;
}

const PROBLEM_MESSAGES = {
  empty: 'labels.row.empty',
  tooLong: 'labels.row.tooLong',
  unsupportedText: 'labels.row.unsupportedText',
} as const;

// Rows keep their props while another row or the paste box changes, so memo
// skips their previews.
const LabelRow = memo(function LabelRow({ entry, plan, measurer }: LabelRowProps) {
  const t = useTranslation();
  const { updateEntry, removeEntry } = useLabelListStore(
    useShallow((state) => ({ updateEntry: state.updateEntry, removeEntry: state.removeEntry }))
  );
  const problem = plan?.problem ?? null;

  return (
    <li className="rounded-md border border-stroke-subtle p-2">
      <div className="mb-2 flex items-start justify-between gap-2">
        <LabelPreview
          plan={plan}
          measurer={measurer}
          ariaLabel={t('labels.row.preview', { name: entry.name })}
        />
        <IconButton
          size="sm"
          variant="ghost"
          aria-label={t('labels.row.remove')}
          onClick={() => removeEntry(entry.id)}
        >
          <XIcon className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <Input
          size="sm"
          value={entry.name}
          maxLength={LABEL_NAME_MAX_LENGTH}
          aria-label={t('labels.row.name')}
          error={problem !== null}
          onChange={(e) => updateEntry(entry.id, { name: e.target.value })}
        />
        <Input
          size="sm"
          value={entry.detail}
          maxLength={LABEL_DETAIL_MAX_LENGTH}
          aria-label={t('labels.row.detail')}
          placeholder={t('labels.row.detailPlaceholder')}
          onChange={(e) => updateEntry(entry.id, { detail: e.target.value })}
        />
        <Stepper
          size="sm"
          value={entry.copies}
          min={1}
          max={LABEL_COPIES_MAX}
          aria-label={t('labels.row.copies')}
          onChange={(copies) => updateEntry(entry.id, { copies })}
          onStep={(delta) => updateEntry(entry.id, { copies: entry.copies + delta })}
        />
      </div>
      {problem !== null && (
        <p className="mt-1.5 text-xs text-warning">{t(PROBLEM_MESSAGES[problem])}</p>
      )}
    </li>
  );
});
