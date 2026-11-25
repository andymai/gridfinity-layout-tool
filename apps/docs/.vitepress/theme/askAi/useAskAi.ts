import { nextTick, onBeforeUnmount, onMounted, reactive, watchEffect } from 'vue';
import { readerSettings } from './consent';
import { ASK_AI_PUBLIC, DOCKED_CLASS, DOCK_QUERY, OFF_KEY, PREVIEW_KEY } from './flags';
import {
  MAX_TURNS,
  answerText,
  hasToolCall,
  loadConversation,
  messageText,
  newConversation,
  saveConversation,
  withTurn,
  withoutLastTurn,
} from './history';
import type { Conversation } from './history';
import type { PlanView } from '@/agent/contract';
import { readEvents } from './stream';

export type StepKind = 'read' | 'search' | 'check' | 'plan';

export interface Step {
  readonly id: string;
  readonly kind: StepKind;
  readonly state: 'running' | 'done' | 'error';
  readonly label: string;
}

export interface Exchange {
  readonly id: number;
  readonly question: string;
  text: string;
  thinking: string;
  steps: Step[];
  /** The plans that the answer draws, by handle. */
  plans: Record<string, PlanView>;
  status: 'waiting' | 'streaming' | 'done' | 'stopped' | 'error';
  notice: string | null;
  traceId: string | null;
  feedback: 1 | -1 | null;
  stored: boolean;
}

export function isLive(exchange: Exchange): boolean {
  return exchange.status === 'waiting' || exchange.status === 'streaming';
}

const ENDPOINT = '/api/docs-ask';

const NOTICES: Readonly<Record<string, string>> = {
  refusal: 'Ask AI cannot answer this question. Ask it in another way, or search the docs.',
  truncated: 'The answer stopped before its end. Ask again for a shorter answer.',
  resting: 'Ask AI is off until tomorrow. You can still search the docs.',
};

function errorNotice(status: number, code: unknown): string {
  if (code === 'RESTING') return NOTICES.resting;
  if (status === 429) return 'You asked many questions in the last hour. Try again later.';
  if (status === 413) return 'This chat is too long. Start a new chat.';
  if (code === 'busy') return 'Ask AI is busy. Try again in a minute.';
  return 'Ask AI did not answer. Try again.';
}

export const askAi = reactive({
  /** Below the dock width only: the full-screen view is showing. */
  open: false,
  /** True after the first open, so the panel stays mounted and keeps its scroll. */
  opened: false,
  available: false,
  /** The availability check is done, so the dock class can follow `available`. */
  checked: false,
  docked: false,
  resting: false,
  /** The chat holds MAX_TURNS turns, the most that the server takes back. */
  full: false,
  exchanges: [] as Exchange[],
});

let conversation: Conversation | null = null;
let controller: AbortController | null = null;
let nextId = 1;

function store(kind: 'session' | 'local'): Storage | null {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

const newSessionId = (): string => crypto.randomUUID();

function post(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

function chat(): Conversation {
  conversation ??= loadConversation(store('session'), newSessionId);
  return conversation;
}

function keep(next: Conversation): void {
  conversation = next;
  askAi.full = next.turns.length >= MAX_TURNS;
  saveConversation(store('session'), next);
}

function rememberOff(off: boolean): void {
  try {
    if (off) store('local')?.setItem(OFF_KEY, '1');
    else store('local')?.removeItem(OFF_KEY);
  } catch {
    // Without the flag, a page only shifts once more while Ask AI is off.
  }
}

function isPlanView(value: unknown): value is PlanView {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Record<string, unknown>;
  return (
    typeof plan.handle === 'string' &&
    typeof plan.link === 'string' &&
    Array.isArray(plan.bins) &&
    typeof plan.grid === 'object' &&
    plan.grid !== null
  );
}

function settleSteps(current: Exchange): void {
  current.steps = current.steps.map((step) =>
    step.state === 'running' ? { ...step, state: 'error' } : step
  );
}

function exchange(question: string): Exchange {
  return {
    id: nextId++,
    question,
    text: '',
    thinking: '',
    steps: [],
    plans: {},
    status: 'waiting',
    notice: null,
    traceId: null,
    feedback: null,
    stored: false,
  };
}

export async function checkAvailability(search: string): Promise<void> {
  try {
    await loadAvailability(search);
  } finally {
    askAi.checked = true;
  }
}

function rememberPreview(fromUrl: boolean): boolean {
  try {
    const session = store('session');
    if (fromUrl) session?.setItem(PREVIEW_KEY, '1');
    return session?.getItem(PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

async function loadAvailability(search: string): Promise<void> {
  if ((import.meta.env.VITE_SELF_HOSTED as string | undefined) === '1') return;
  const fromUrl = new URLSearchParams(search).get('ask') === '1';
  // A full or blocked store must not undo the opt-in that the URL just gave.
  const remembered = rememberPreview(fromUrl);
  if (!ASK_AI_PUBLIC && !fromUrl && !remembered) return;
  try {
    const response = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const status = (await response.json()) as { enabled?: unknown; resting?: unknown };
    askAi.available = status.enabled === true;
    askAi.resting = status.resting === true;
    rememberOff(!askAi.available);
  } catch {
    return;
  }
  if (askAi.exchanges.length === 0) {
    const restored = chat();
    askAi.full = restored.turns.length >= MAX_TURNS;
    askAi.exchanges = restored.turns.map((turn) => ({
      ...exchange(turn.question),
      text: answerText(turn),
      plans: { ...turn.plans },
      traceId: turn.traceId ?? null,
      status: 'done' as const,
      stored: true,
    }));
  }
}

export function setOpen(open: boolean): void {
  askAi.open = open && askAi.available;
  if (askAi.open) askAi.opened = true;
}

export async function closeAskAi(): Promise<void> {
  setOpen(false);
  // The page stays inert until the panel's watcher runs, and an inert button
  // takes no focus.
  await nextTick();
  document.getElementById('ask-ai-button')?.focus();
}

function onShortcut(event: KeyboardEvent): void {
  if (!askAi.available || event.altKey || !(event.metaKey || event.ctrlKey)) return;
  if (event.key.toLowerCase() !== 'i') return;
  event.preventDefault();
  if (askAi.docked) {
    document
      .querySelector<HTMLElement>('#ask-ai-panel textarea, #ask-ai-panel .panel-footer button')
      ?.focus();
  } else if (askAi.open) {
    void closeAskAi();
  } else {
    setOpen(true);
  }
}

export function useAskAiHost(): void {
  let dock: MediaQueryList | null = null;
  const onDockChange = (): void => {
    askAi.docked = dock?.matches ?? false;
  };
  onMounted(() => {
    dock = window.matchMedia(DOCK_QUERY);
    onDockChange();
    dock.addEventListener('change', onDockChange);
    window.addEventListener('keydown', onShortcut);
    // Until the check is done, the class stays as the head script set it.
    watchEffect(() => {
      if (!askAi.checked) return;
      document.documentElement.classList.toggle(DOCKED_CLASS, askAi.available && askAi.docked);
    });
    void checkAvailability(window.location.search);
  });
  onBeforeUnmount(() => {
    dock?.removeEventListener('change', onDockChange);
    window.removeEventListener('keydown', onShortcut);
  });
}

export const busy = (): boolean => controller !== null;

export async function ask(question: string, page: string): Promise<void> {
  const text = question.trim();
  if (!text || controller) return;
  askAi.exchanges.push(exchange(text));
  // The pushed object is now reactive; write to that one.
  const current = askAi.exchanges[askAi.exchanges.length - 1] as Exchange;
  const { analytics, locale } = readerSettings(store('local'));
  const before = chat();
  const messages: unknown[] = [];
  const abort = new AbortController();
  controller = abort;
  try {
    const response = await post(
      {
        op: 'ask',
        sessionId: before.sessionId,
        question: text,
        page,
        locale,
        turns: before.turns.map(({ traceId: _local, plans: _drawn, ...turn }) => turn),
        analytics,
      },
      abort.signal
    );
    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
      if (body?.code === 'RESTING') askAi.resting = true;
      current.status = 'error';
      current.notice = errorNotice(response.status, body?.code);
      return;
    }
    current.status = 'streaming';
    let roundEnded = false;
    for await (const { event, data } of readEvents(response.body)) {
      const payload = data as Record<string, unknown>;
      if (event === 'start') {
        current.traceId = typeof payload.traceId === 'string' ? payload.traceId : null;
      } else if (event === 'step') {
        const step = payload as unknown as Step;
        const at = current.steps.findIndex((s) => s.id === step.id);
        if (at < 0) current.steps.push(step);
        else current.steps.splice(at, 1, step);
      } else if (event === 'plan' && isPlanView(payload.plan)) {
        current.plans[payload.plan.handle] = payload.plan;
      } else if (event === 'thinking' && typeof payload.text === 'string') {
        if (roundEnded && current.thinking) current.thinking += '\n\n';
        roundEnded = false;
        current.thinking += payload.text;
      } else if (event === 'text' && typeof payload.text === 'string') {
        current.text += payload.text;
      } else if (event === 'message') {
        messages.push(payload.content);
        roundEnded = true;
        // Text before a tool call is not the answer; the next round writes it.
        if (hasToolCall(payload.content)) current.text = '';
      } else if (event === 'notice' && typeof payload.code === 'string') {
        current.notice = NOTICES[payload.code] ?? null;
        if (payload.code === 'resting') askAi.resting = true;
      } else if (event === 'error') {
        current.status = 'error';
        current.notice = errorNotice(500, payload.code);
      } else if (event === 'done') {
        current.status = 'done';
        // A reload shows only the last message, so the live view does too.
        if (messages.length > 0) current.text = messageText(messages.at(-1));
        const turn = payload.turn as Record<string, unknown> | undefined;
        if (turn && typeof turn.signature === 'string') {
          keep(
            withTurn(chat(), {
              question: String(turn.question),
              page: String(turn.page),
              locale: String(turn.locale),
              signature: turn.signature,
              messages,
              ...(current.traceId ? { traceId: current.traceId } : {}),
              ...(Object.keys(current.plans).length > 0 ? { plans: { ...current.plans } } : {}),
            })
          );
          current.stored = true;
        }
      }
    }
    if (current.status === 'streaming') {
      current.status = 'error';
      current.notice = errorNotice(500, null);
    }
  } catch {
    current.status = abort.signal.aborted ? 'stopped' : 'error';
    if (current.status === 'error') current.notice = errorNotice(0, null);
  } finally {
    settleSteps(current);
    controller = null;
  }
}

export function stop(): void {
  controller?.abort();
}

export async function retry(page: string): Promise<void> {
  const last = askAi.exchanges.at(-1);
  if (!last || controller) return;
  if (last.stored) keep(withoutLastTurn(chat()));
  askAi.exchanges.pop();
  await ask(last.question, page);
}

export function newChat(): void {
  stop();
  keep(newConversation(newSessionId));
  askAi.exchanges = [];
}

export function sendFeedback(target: Exchange, value: 1 | -1): void {
  if (!target.traceId || target.feedback === value) return;
  target.feedback = value;
  const { analytics } = readerSettings(store('local'));
  void post({
    op: 'feedback',
    sessionId: chat().sessionId,
    traceId: target.traceId,
    value,
    analytics,
  }).catch(() => undefined);
}
