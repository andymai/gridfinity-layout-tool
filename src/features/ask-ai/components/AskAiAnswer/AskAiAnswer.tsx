import { useEffect, useRef, useState } from 'react';
import { answerSegments, plainAnswer } from '@/agent/client/render';
import type { ShowMe } from '@/agent/client/render';
import { isLive } from '@/agent/client/session';
import type { Exchange, RequestAnswer } from '@/agent/client/session';
import type { PlanView } from '@/agent/contract';
import { Button, IconButton, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { stepSummary, stepText } from '../../utils/stepText';
import { AskAiPlanCard } from '../AskAiPlanCard';
import { AskAiRequestCard } from '../AskAiRequestCard';

export interface AskAiAnswerProps {
  readonly exchange: Exchange;
  readonly last: boolean;
  /** Plans from every turn: a follow-up may show an earlier plan by its handle. */
  readonly plans: Readonly<Record<string, PlanView>>;
  readonly showMe?: ShowMe;
  readonly onShowMe: (label: string) => void;
  readonly onAnswer: (answer: RequestAnswer) => void;
  readonly onRetry: () => void;
  readonly onFeedback: (value: 1 | -1) => void;
  readonly onOpenPlan: (plan: PlanView) => void;
}

// The answer is HTML from render.ts, which escapes all raw HTML but <kbd>.
// These classes style what Markdown makes inside it.
const ANSWER_HTML = cn(
  'text-sm leading-relaxed text-content',
  '[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
  '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2',
  '[&_code]:rounded [&_code]:bg-surface-secondary [&_code]:px-1 [&_code]:text-[0.9em]',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-secondary [&_pre]:p-2 [&_pre]:text-xs',
  '[&_table]:block [&_table]:overflow-x-auto [&_table]:text-xs [&_td]:border [&_td]:border-stroke-subtle [&_td]:px-2 [&_th]:border [&_th]:border-stroke-subtle [&_th]:px-2',
  '[&_kbd]:rounded [&_kbd]:border [&_kbd]:border-stroke [&_kbd]:px-1 [&_kbd]:font-mono [&_kbd]:text-[0.85em]',
  '[&_.ui-label]:rounded [&_.ui-label]:bg-surface-secondary [&_.ui-label]:px-1 [&_.ui-label]:font-medium',
  '[&_.ui-label-show]:cursor-pointer [&_.ui-label-show]:text-accent [&_.ui-label-show]:underline [&_.ui-label-show]:decoration-dotted [&_.ui-label-show]:underline-offset-2 [&_.ui-label-show:hover]:bg-accent-muted',
  '[&_.code-block]:my-2 [&_.code-block]:grid [&_.copy-code]:justify-self-end [&_.copy-code]:text-xs [&_.copy-code]:text-content-secondary'
);

export function AskAiAnswer({
  exchange,
  last,
  plans,
  showMe,
  onShowMe,
  onAnswer,
  onRetry,
  onFeedback,
  onOpenPlan,
}: AskAiAnswerProps) {
  const t = useTranslation();
  const [showSteps, setShowSteps] = useState(false);
  const [copied, setCopied] = useState(false);
  const live = isLive(exchange);
  const segments = answerSegments(exchange.text, {
    streaming: live,
    // The app has no docs captures; their lines drop out.
    isCapture: () => false,
    isPlan: (handle) => Object.hasOwn(plans, handle),
    siteLinksOnly: exchange.personal,
    showMe,
    copyLabel: t('askAi.copy'),
  });
  const summary = stepSummary(exchange, t);

  // The buttons and links in the HTML are real buttons and links; one
  // listener on their container handles their clicks.
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const onClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      const chip = target.closest<HTMLElement>('[data-show-me]');
      if (chip?.dataset.showMe) {
        onShowMe(chip.dataset.showMe);
        return;
      }
      const copyCode = target.closest<HTMLButtonElement>('button[data-copy-code]');
      if (copyCode) {
        const code = copyCode.parentElement?.querySelector('code')?.textContent ?? '';
        void navigator.clipboard.writeText(code).catch(() => undefined);
        return;
      }
      // The docs are a site of their own, so a docs link opens beside the app.
      const docs = target.closest<HTMLAnchorElement>('a[data-docs-link]');
      if (docs) {
        event.preventDefault();
        window.open(docs.getAttribute('href') ?? '/docs', '_blank', 'noopener');
      }
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onShowMe]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(plainAnswer(exchange.text));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="mb-6">
      <p className="mb-2 ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-accent-muted px-3 py-2 text-sm font-medium text-content">
        {exchange.question}
      </p>

      {exchange.steps.length > 0 && (live || showSteps) && (
        <ol
          className="mb-2 space-y-0.5 text-xs text-content-secondary"
          aria-label={t('askAi.steps')}
        >
          {exchange.steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'h-2 w-2 flex-none rounded-full',
                  step.state === 'running' && 'animate-pulse bg-accent motion-reduce:animate-none',
                  step.state === 'done' && 'bg-success',
                  step.state === 'error' && 'bg-danger',
                  step.state === 'waiting' && 'bg-warning'
                )}
              />
              {stepText(step, t)}
            </li>
          ))}
        </ol>
      )}
      {summary && !live && (
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={showSteps}
          onClick={() => setShowSteps(!showSteps)}
        >
          <svg
            viewBox="0 0 16 16"
            className={cn('h-3 w-3 transition-transform', showSteps && 'rotate-90')}
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6 4l4 4-4 4z" />
          </svg>
          {summary}
        </Button>
      )}

      {exchange.request && <AskAiRequestCard request={exchange.request} onAnswer={onAnswer} />}

      {live && !exchange.text && (
        <p className="animate-pulse text-sm text-content-secondary motion-reduce:animate-none">
          {exchange.steps.some((step) => step.state === 'running')
            ? t('askAi.working')
            : t('askAi.thinking')}
        </p>
      )}

      {exchange.thinking && !live && (
        <details className="my-2 text-xs text-content-secondary">
          <summary className="cursor-pointer">{t('askAi.showReasoning')}</summary>
          <p className="mt-1 whitespace-pre-wrap border-l-2 border-stroke-subtle pl-2">
            {exchange.thinking}
          </p>
        </details>
      )}

      <div ref={body}>
        {segments.map((segment, i) =>
          segment.kind === 'html' ? (
            <div
              key={i}
              className={ANSWER_HTML}
              // render.ts escapes the model's HTML and keeps only safe links.
              dangerouslySetInnerHTML={{ __html: segment.html }}
            />
          ) : segment.kind === 'plan' ? (
            <AskAiPlanCard
              key={`${i}-${segment.handle}`}
              plan={plans[segment.handle]}
              onOpen={onOpenPlan}
            />
          ) : null
        )}
      </div>

      {exchange.status === 'stopped' && (
        <p className="mt-2 text-xs text-content-secondary">{t('askAi.notice.stopped')}</p>
      )}
      {exchange.notice && (
        <p className="mt-2 text-xs text-content-secondary">
          {t(`askAi.notice.${exchange.notice}`)}
        </p>
      )}

      {!live && exchange.status !== 'asking' && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {exchange.text && (
            <Button size="sm" variant="ghost" onClick={() => void copy()}>
              {copied ? t('askAi.copied') : t('askAi.copy')}
            </Button>
          )}
          {/* Its question asked again could propose the same changes again. */}
          {last && exchange.notice !== 'appliedNoAnswer' && (
            <Button size="sm" variant="ghost" onClick={onRetry}>
              {t('askAi.retry')}
            </Button>
          )}
          {exchange.traceId && exchange.status === 'done' && (
            <>
              <IconButton
                size="sm"
                aria-label={t('askAi.good')}
                pressed={exchange.feedback === 1}
                onClick={() => onFeedback(1)}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  aria-hidden="true"
                >
                  <path d="M7 10v11H3V10zm2 11h8.6a2 2 0 0 0 2-1.6l1.3-7A2 2 0 0 0 18.9 10H14l.9-4.3A1.6 1.6 0 0 0 13.3 4L9 10z" />
                </svg>
              </IconButton>
              <IconButton
                size="sm"
                aria-label={t('askAi.bad')}
                pressed={exchange.feedback === -1}
                onClick={() => onFeedback(-1)}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  aria-hidden="true"
                >
                  <path d="M17 14V3h4v11zm-2-11H6.4a2 2 0 0 0-2 1.6l-1.3 7A2 2 0 0 0 5.1 14H10l-.9 4.3a1.6 1.6 0 0 0 1.6 1.7L15 14z" />
                </svg>
              </IconButton>
            </>
          )}
        </div>
      )}
    </article>
  );
}
