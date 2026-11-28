import { useId, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PreparedCall, ReaderRequest } from '@/agent/client/session';
import { useLayoutStore } from '@/core/store';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { previewChanges } from '../../utils/changePreview';
import type { ChangeCallData } from '../../utils/browserCalls';
import { AskAiDrawerMap } from '../AskAiDrawerMap';

export interface AskAiRequestCardProps {
  readonly request: ReaderRequest;
  readonly onAnswer: (allow: boolean) => void;
}

const PRIVACY_LINK = '/docs/introduction/your-data#ask-ai';

function ChangeSection({ call }: { readonly call: PreparedCall }) {
  const t = useTranslation();
  const { activeLayoutId, layout } = useLayoutStore(
    useShallow((s) => ({ activeLayoutId: s.activeLayoutId, layout: s.layout }))
  );
  const input = (call.data as ChangeCallData | null)?.input;
  // The layout can change while the card waits, so the preview follows it.
  const preview = useMemo(
    () => previewChanges(activeLayoutId === null ? null : { id: activeLayoutId, layout }, input, t),
    [activeLayoutId, layout, input, t]
  );
  return (
    <div className="space-y-2">
      {call.title && <p className="text-sm font-medium text-content">{call.title}</p>}
      {preview.lines.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-content-secondary">
          {preview.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {preview.kind === 'preview' && (
        <>
          <AskAiDrawerMap
            grid={preview.grid}
            bins={preview.bins}
            label={t('askAi.change.mapLabel')}
          />
          <p className="text-xs text-content-tertiary">
            {preview.stashed > 0
              ? t('askAi.change.undoWithStash', { count: preview.stashed })
              : t('askAi.change.undo')}
          </p>
        </>
      )}
      {preview.kind === 'refused' && (
        <p className="text-xs text-warning" role="status">
          {t('askAi.change.refused', { reason: preview.reason })}
        </p>
      )}
      {preview.kind === 'unavailable' && (
        <p className="text-xs text-content-secondary">{t('askAi.change.unavailable')}</p>
      )}
    </div>
  );
}

function changeState(calls: readonly PreparedCall[]): 'none' | 'ok' | 'blocked' {
  const changes = calls.filter((call) => call.kind === 'change');
  if (changes.length === 0) return 'none';
  return changes.every((call) => call.unavailable) ? 'blocked' : 'ok';
}

/**
 * A request from Ask AI that waits for the reader: reads of their data, which
 * they allow or not, and changes to the open layout, which they apply or not.
 */
export function AskAiRequestCard({ request, onAnswer }: AskAiRequestCardProps) {
  const t = useTranslation();
  const headingId = useId();
  const reads = request.calls.filter((call) => call.kind !== 'change');
  const changes = request.calls.filter((call) => call.kind === 'change');
  const readable = reads.some((call) => !call.unavailable);
  const change = changeState(request.calls);
  const busy = request.state !== 'asking';

  if (request.state === 'loading') {
    return (
      <section className="rounded-lg border border-stroke-subtle bg-surface-secondary p-3 text-sm text-content-secondary">
        {t('askAi.request.loading')}
      </section>
    );
  }

  return (
    <section
      className="space-y-3 rounded-lg border border-stroke bg-surface-secondary p-3"
      role="group"
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className="text-sm font-semibold text-content">
        {change === 'none' ? t('askAi.request.readTitle') : t('askAi.change.title')}
      </h3>
      {changes.map((call) => (
        <ChangeSection key={call.id} call={call} />
      ))}
      {reads.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-content-secondary">{t('askAi.request.readHint')}</p>
          <ul className="space-y-1.5">
            {reads.map((call) => (
              <li key={call.id} className="text-sm">
                <span className="font-medium text-content">{call.title}</span>
                {call.unavailable ? (
                  <span className="block text-xs text-content-tertiary">
                    {t('askAi.request.unavailable')}
                  </span>
                ) : (
                  call.preview && (
                    <details className="mt-1 text-xs text-content-secondary">
                      <summary className="cursor-pointer">
                        {t('askAi.request.whatItShares')}
                      </summary>
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-surface p-2 font-mono text-micro">
                        {call.preview}
                      </pre>
                    </details>
                  )
                )}
              </li>
            ))}
          </ul>
          {readable && (
            <p className="text-xs text-content-tertiary">
              {t('askAi.request.readNote')}{' '}
              <a
                className="text-accent underline underline-offset-2"
                href={PRIVACY_LINK}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('askAi.request.privacy')}
              </a>
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {change === 'ok' ? (
          <>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => onAnswer(true)}>
              {t('askAi.change.apply')}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAnswer(false)}>
              {t('askAi.change.dontApply')}
            </Button>
          </>
        ) : readable ? (
          <>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => onAnswer(true)}>
              {t('askAi.request.allow')}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAnswer(false)}>
              {t('askAi.request.deny')}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAnswer(false)}>
            {t('askAi.request.continue')}
          </Button>
        )}
      </div>
    </section>
  );
}
