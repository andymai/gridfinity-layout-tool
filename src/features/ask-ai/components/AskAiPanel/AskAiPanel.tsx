import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ShowMe } from '@/agent/client/render';
import { isLive } from '@/agent/client/session';
import type { PlanView } from '@/agent/contract';
import { useSelectionStore } from '@/core/store/selection';
import { Button, IconButton, Textarea, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useAskAiChat, useChatBridge } from '../../hooks/useAskAiChat';
import { useOpenPlan } from '../../hooks/useOpenPlan';
import { useAskAiStore } from '../../store/askAiStore';
import { chatSession, liveExchange } from '../../utils/askAiChat';
import { AskAiAnswer } from '../AskAiAnswer';

export interface AskAiPanelProps {
  /** docked: a column beside the editor; overlay and sheet cover part of the screen. */
  readonly variant: 'docked' | 'overlay' | 'sheet';
  readonly onClose: () => void;
  /**
   * The control that a label names, as a jump that shows it, or null when
   * the app has no place to show it from here.
   */
  readonly findControl?: (label: string) => (() => void) | null;
  /** Runs before a control shows or after a plan opens, to clear the way, such as closing an overlay. */
  readonly onLeave?: (to: 'control' | 'plan') => void;
}

const STARTERS = ['askAi.starter.add', 'askAi.starter.room', 'askAi.starter.printBed'] as const;

export function AskAiPanel({ variant, onClose, findControl, onLeave }: AskAiPanelProps) {
  const t = useTranslation();
  useChatBridge();
  const chat = useAskAiChat();
  const openPlan = useOpenPlan();
  const binSelected = useSelectionStore((s) => s.selectedBinIds.length > 0);
  const resting = useAskAiStore((s) => s.resting) || chat.resting;
  const page = binSelected ? 'app/layout/bin' : 'app/layout';
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const working = chat.exchanges.some(isLive);
  const last = chat.exchanges.at(-1);

  useEffect(() => {
    chatSession().restore();
    // On a phone, focus would raise the keyboard over half of the sheet.
    if (variant !== 'sheet') input.current?.focus();
  }, [variant]);

  // Follow a streaming answer while the reader is near the bottom.
  const progress = chat.exchanges
    .map((e) => `${e.text.length}:${e.steps.length}:${e.request?.state ?? ''}`)
    .join();
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [progress]);

  const plans = useMemo(
    () =>
      Object.assign({}, ...chat.exchanges.map((exchange) => exchange.plans)) as Record<
        string,
        PlanView
      >,
    [chat.exchanges]
  );

  const showMe = useMemo<ShowMe | undefined>(
    () =>
      findControl
        ? { showMe: (label) => findControl(label) !== null, title: t('askAi.showMe') }
        : undefined,
    [findControl, t]
  );

  function submit(question: string = draft): void {
    if (!question.trim() || chatSession().busy()) return;
    setDraft('');
    void chatSession().ask(question, page);
  }

  function onComposerKey(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function showControl(label: string): void {
    const jump = findControl?.(label);
    if (!jump) return;
    onLeave?.('control');
    jump();
  }

  async function open(plan: PlanView): Promise<void> {
    if (await openPlan(plan)) onLeave?.('plan');
  }

  const announcement = !last
    ? ''
    : isLive(last)
      ? t('askAi.announce.answering')
      : last.notice
        ? t(`askAi.notice.${last.notice}`)
        : last.status === 'asking'
          ? t('askAi.announce.asking')
          : last.status === 'done'
            ? t('askAi.announce.done')
            : '';

  return (
    <section
      id="ask-ai-panel"
      aria-labelledby="ask-ai-title"
      className={cn(
        'flex h-full min-h-0 flex-col bg-surface text-content',
        variant === 'docked' && 'w-[360px] flex-none border-l border-stroke-subtle xl:w-[400px]',
        variant === 'overlay' && 'w-[400px] max-w-full border-l border-stroke-subtle shadow-xl'
      )}
    >
      {variant !== 'sheet' && (
        <header className="flex h-12 flex-none items-center gap-2 border-b border-stroke-subtle px-3">
          <h2 id="ask-ai-title" className="mr-auto flex items-center gap-1.5 text-sm font-semibold">
            {t('askAi.title')}
            <span className="rounded-full bg-surface-secondary px-1.5 text-micro font-medium text-content-secondary">
              {t('askAi.beta')}
            </span>
          </h2>
          {chat.exchanges.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={working}
              onClick={() => chatSession().newChat()}
            >
              {t('askAi.newChat')}
            </Button>
          )}
          <IconButton size="sm" aria-label={t('askAi.close')} onClick={onClose}>
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </IconButton>
        </header>
      )}
      {variant === 'sheet' && chat.exchanges.length > 0 && (
        <div className="flex flex-none justify-end px-3 pt-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={working}
            onClick={() => chatSession().newChat()}
          >
            {t('askAi.newChat')}
          </Button>
        </div>
      )}

      <p className="sr-only" role="status">
        {announcement}
      </p>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {chat.exchanges.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-content-secondary">{t('askAi.intro')}</p>
            <ul className="grid gap-2">
              {STARTERS.map((key) => (
                <li key={key}>
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    className="h-auto justify-start whitespace-normal py-2 text-left"
                    disabled={resting}
                    onClick={() => submit(t(key))}
                  >
                    {t(key)}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {chat.exchanges.map((exchange, i) => (
          <AskAiAnswer
            key={exchange.id}
            exchange={exchange}
            last={i === chat.exchanges.length - 1}
            plans={plans}
            showMe={showMe}
            onShowMe={showControl}
            onAnswer={(answer) => {
              const live = liveExchange(exchange.id);
              if (live) void chatSession().answerRequest(live, answer);
            }}
            onRetry={() => void chatSession().retry(page)}
            onFeedback={(value) => {
              const live = liveExchange(exchange.id);
              if (live) chatSession().sendFeedback(live, value);
            }}
            onOpenPlan={(plan) => void open(plan)}
          />
        ))}
      </div>

      <footer className="flex-none border-t border-stroke-subtle px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {resting ? (
          <p className="text-sm text-content-secondary">{t('askAi.resting')}</p>
        ) : chat.full && !working ? (
          <div className="flex items-center justify-between gap-2 text-sm text-content-secondary">
            {t('askAi.full')}
            <Button size="sm" variant="ghost" onClick={() => chatSession().newChat()}>
              {t('askAi.newChat')}
            </Button>
          </div>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Textarea
              ref={input}
              value={draft}
              rows={2}
              maxLength={1000}
              resize="none"
              placeholder={t('askAi.placeholder')}
              aria-label={t('askAi.question')}
              className="min-h-[2.5rem] flex-1 text-base md:text-sm"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKey}
            />
            {working ? (
              <Button size="md" variant="secondary" onClick={() => chatSession().stop()}>
                {t('askAi.stop')}
              </Button>
            ) : (
              <Button size="md" variant="primary" type="submit" disabled={!draft.trim()}>
                {t('askAi.send')}
              </Button>
            )}
          </form>
        )}
        <p className="mt-1 text-micro text-content-tertiary">{t('askAi.fine')}</p>
      </footer>
    </section>
  );
}
