import type { PlanView } from '@/agent/contract';
import {
  MAX_TURNS,
  answerText,
  hasToolCall,
  isPlanView,
  loadConversation,
  messageText,
  newConversation,
  saveConversation,
  sharedData,
  withTurn,
  withoutLastTurn,
} from './history';
import type { Conversation, StoredTurn } from './history';
import { readEvents } from './stream';

export type StepKind = 'read' | 'search' | 'check' | 'plan' | 'yours';

export interface Step {
  readonly id: string;
  readonly kind: StepKind;
  readonly state: 'running' | 'waiting' | 'done' | 'error';
  readonly label: string;
}

/** A browser call as the server asked for it. */
export interface BrowserCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

/** One browser call, run before the reader decides, with exactly what Allow would send. */
export interface PreparedCall {
  readonly id: string;
  readonly title: string;
  /** The text that the model would read, shown in the panel before the reader allows it. */
  readonly preview: string | null;
  readonly data: unknown;
  readonly unavailable: boolean;
}

/** Browser calls that wait for the reader to allow or decline them. */
export interface ReaderRequest {
  /** The server's signed envelope, sent back as it came. */
  readonly pending: unknown;
  /** The turn's messages so far, kept for the turn once it ends. */
  readonly messages: readonly unknown[];
  calls: PreparedCall[];
  state: 'loading' | 'asking' | 'sending';
}

/** Why an answer stopped or failed. Each panel words it in its own language. */
export type NoticeCode =
  'refusal' | 'truncated' | 'resting' | 'rateLimited' | 'tooLong' | 'busy' | 'expired' | 'failed';

export interface Exchange {
  readonly id: number;
  readonly question: string;
  text: string;
  thinking: string;
  steps: Step[];
  /** The plans that the answer draws, by handle. */
  plans: Record<string, PlanView>;
  /** asking: the turn waits for the reader to allow a read of their data. */
  status: 'waiting' | 'streaming' | 'asking' | 'done' | 'stopped' | 'error';
  request: ReaderRequest | null;
  /** The turn holds the reader's own data, so its answer may link only to this site. */
  personal: boolean;
  notice: NoticeCode | null;
  traceId: string | null;
  feedback: 1 | -1 | null;
  stored: boolean;
}

/** What the session writes. A panel may hold it in a reactive object of its own. */
export interface SessionState {
  resting: boolean;
  /** The chat holds MAX_TURNS turns, the most that the server takes back. */
  full: boolean;
  exchanges: Exchange[];
}

export interface SessionHost {
  readonly state: SessionState;
  /** Called after each change to the state, for a panel that does not track writes itself. */
  readonly changed: () => void;
  readonly endpoint: string;
  /** The sessionStorage key of this panel's chat. */
  readonly storageKey: string;
  readonly storage: () => Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly settings: () => { readonly analytics: boolean; readonly locale: string };
  /** Runs each call in the browser. It must resolve, with a call marked unavailable when it cannot run. */
  readonly prepareCalls: (calls: readonly BrowserCall[]) => Promise<PreparedCall[]>;
  /** The step label of a read that the reader did not allow. */
  readonly declinedLabel: string;
  readonly newId: () => string;
}

export interface Session {
  /** Shows the chat that this tab kept, when the panel shows none yet. */
  restore(): void;
  ask(question: string, page: string): Promise<void>;
  /** Allow sends what the panel showed; Don't allow sends only that the reader declined. */
  answerRequest(target: Exchange, allow: boolean): Promise<void>;
  stop(): void;
  retry(page: string): Promise<void>;
  newChat(): void;
  sendFeedback(target: Exchange, value: 1 | -1): void;
  busy(): boolean;
}

export function isLive(exchange: Exchange): boolean {
  return exchange.status === 'waiting' || exchange.status === 'streaming';
}

const STREAM_NOTICES: ReadonlySet<string> = new Set(['refusal', 'truncated', 'resting']);

function errorNotice(status: number, code: unknown): NoticeCode {
  if (code === 'RESTING') return 'resting';
  if (status === 429) return 'rateLimited';
  if (status === 413) return 'tooLong';
  if (code === 'busy') return 'busy';
  return 'failed';
}

function isCall(value: unknown): value is BrowserCall {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

const sendable = (turns: readonly StoredTurn[]): unknown[] =>
  turns.map(({ traceId: _local, plans: _drawn, ...turn }) => turn);

function exchange(id: number, question: string): Exchange {
  return {
    id,
    question,
    text: '',
    thinking: '',
    steps: [],
    plans: {},
    status: 'waiting',
    request: null,
    personal: false,
    notice: null,
    traceId: null,
    feedback: null,
    stored: false,
  };
}

function settleSteps(current: Exchange): void {
  current.steps = current.steps.map((step) =>
    step.state === 'running' ? { ...step, state: 'error' } : step
  );
}

/**
 * The Ask AI session that both panels run: it sends questions and the reader's
 * answers to browser calls, reads the stream into the state, and keeps the
 * signed turns in sessionStorage. It knows no framework: a Vue panel passes a
 * reactive state, a React panel a plain one and a `changed` hook.
 */
export function createSession(host: SessionHost): Session {
  const { state, changed } = host;
  let conversation: Conversation | null = null;
  let controller: AbortController | null = null;
  let nextId = 1;

  const post = (body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> =>
    fetch(host.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

  function chat(): Conversation {
    conversation ??= loadConversation(host.storage(), host.storageKey, host.newId);
    return conversation;
  }

  function keep(next: Conversation): void {
    conversation = next;
    state.full = next.turns.length >= MAX_TURNS;
    saveConversation(host.storage(), host.storageKey, next);
  }

  // The state's own copy, which a reactive panel tracks; not the object pushed.
  function push(question: string): Exchange {
    state.exchanges.push(exchange(nextId++, question));
    return state.exchanges[state.exchanges.length - 1];
  }

  async function prepare(current: Exchange, calls: unknown[]): Promise<void> {
    const asked = calls.filter(isCall);
    let prepared: PreparedCall[];
    try {
      prepared = await host.prepareCalls(asked);
    } catch {
      prepared = asked.map((call) => ({
        id: call.id,
        title: '',
        preview: null,
        data: null,
        unavailable: true,
      }));
    }
    const request = current.request;
    if (request === null || request.state !== 'loading') return;
    request.calls = prepared;
    request.state = 'asking';
    changed();
  }

  /** Reads one response stream into the exchange: a whole turn, or the rest of one after a resume. */
  async function consume(
    current: Exchange,
    body: ReadableStream<Uint8Array>,
    messages: unknown[]
  ): Promise<void> {
    current.status = 'streaming';
    changed();
    let roundEnded = false;
    for await (const { event, data } of readEvents(body)) {
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
        current.notice = STREAM_NOTICES.has(payload.code) ? (payload.code as NoticeCode) : null;
        if (payload.code === 'resting') state.resting = true;
      } else if (event === 'error') {
        current.status = 'error';
        current.notice = errorNotice(500, payload.code);
      } else if (event === 'pending') {
        current.status = 'asking';
        current.request = {
          pending: payload.pending,
          messages: [...messages],
          calls: [],
          state: 'loading',
        };
        void prepare(current, Array.isArray(payload.calls) ? payload.calls : []);
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
              ...(Array.isArray(turn.results) ? { results: turn.results as unknown[] } : {}),
              ...(current.traceId ? { traceId: current.traceId } : {}),
              ...(Object.keys(current.plans).length > 0 ? { plans: { ...current.plans } } : {}),
            })
          );
          current.stored = true;
        }
      }
      changed();
    }
    if (current.status === 'streaming') {
      current.status = 'error';
      current.notice = errorNotice(500, null);
      changed();
    }
  }

  // A new question leaves an unanswered request behind: the server never
  // hears back, and its envelope expires.
  function abandonRequests(): void {
    for (const earlier of state.exchanges) {
      if (earlier.status !== 'asking') continue;
      earlier.status = 'stopped';
      earlier.request = null;
      earlier.steps = earlier.steps.map((step) =>
        step.state === 'waiting' ? { ...step, state: 'error' } : step
      );
    }
  }

  async function failed(target: Exchange, response: Response, expired: boolean): Promise<void> {
    const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
    if (body?.code === 'RESTING') state.resting = true;
    target.status = 'error';
    target.notice =
      expired && response.status === 410 ? 'expired' : errorNotice(response.status, body?.code);
  }

  function settle(target: Exchange): void {
    settleSteps(target);
    controller = null;
    changed();
  }

  async function ask(question: string, page: string): Promise<void> {
    const text = question.trim();
    if (!text || controller) return;
    abandonRequests();
    const current = push(text);
    const { analytics, locale } = host.settings();
    const before = chat();
    // The server sends earlier turns back to the model, the reader's data with them.
    current.personal =
      before.turns.some(sharedData) || state.exchanges.some((earlier) => earlier.personal);
    const abort = new AbortController();
    controller = abort;
    changed();
    try {
      const response = await post(
        {
          op: 'ask',
          sessionId: before.sessionId,
          question: text,
          page,
          locale,
          turns: sendable(before.turns),
          analytics,
        },
        abort.signal
      );
      if (!response.ok || !response.body) {
        await failed(current, response, false);
        return;
      }
      await consume(current, response.body, []);
    } catch {
      current.status = abort.signal.aborted ? 'stopped' : 'error';
      if (current.status === 'error') current.notice = errorNotice(0, null);
    } finally {
      settle(current);
    }
  }

  async function answerRequest(target: Exchange, allow: boolean): Promise<void> {
    const request = target.request;
    if (request === null || request.state !== 'asking' || controller) return;
    request.state = 'sending';
    // A read that this browser could not run goes as unavailable either way.
    const results = request.calls.map((call) => {
      if (call.unavailable) return { callId: call.id, status: 'unavailable' };
      return allow
        ? { callId: call.id, status: 'shared', data: call.data }
        : { callId: call.id, status: 'declined' };
    });
    const asked = new Set(request.calls.map((call) => call.id));
    target.steps = target.steps.map((step) =>
      asked.has(step.id)
        ? { ...step, state: 'done', label: allow ? step.label : host.declinedLabel }
        : step
    );
    if (results.some((result) => result.status === 'shared')) target.personal = true;
    target.status = 'waiting';
    const { analytics } = host.settings();
    const before = chat();
    const abort = new AbortController();
    controller = abort;
    changed();
    try {
      const response = await post(
        {
          op: 'resume',
          sessionId: before.sessionId,
          pending: request.pending,
          results,
          turns: sendable(before.turns),
          analytics,
        },
        abort.signal
      );
      target.request = null;
      if (!response.ok || !response.body) {
        await failed(target, response, true);
        return;
      }
      await consume(target, response.body, [...request.messages]);
    } catch {
      target.request = null;
      target.status = abort.signal.aborted ? 'stopped' : 'error';
      if (target.status === 'error') target.notice = errorNotice(0, null);
    } finally {
      settle(target);
    }
  }

  function stop(): void {
    controller?.abort();
  }

  function restore(): void {
    if (state.exchanges.length > 0) return;
    const restored = chat();
    state.full = restored.turns.length >= MAX_TURNS;
    // Shared data stays in the model's context for the rest of the chat.
    let shared = false;
    state.exchanges = restored.turns.map((turn) => ({
      ...exchange(nextId++, turn.question),
      text: answerText(turn),
      plans: { ...turn.plans },
      personal: (shared ||= sharedData(turn)),
      traceId: turn.traceId ?? null,
      status: 'done' as const,
      stored: true,
    }));
    changed();
  }

  async function retry(page: string): Promise<void> {
    const last = state.exchanges.at(-1);
    if (!last || controller) return;
    if (last.stored) keep(withoutLastTurn(chat()));
    state.exchanges.pop();
    await ask(last.question, page);
  }

  function newChat(): void {
    stop();
    keep(newConversation(host.newId));
    state.exchanges = [];
    changed();
  }

  function sendFeedback(target: Exchange, value: 1 | -1): void {
    if (!target.traceId || target.feedback === value) return;
    target.feedback = value;
    changed();
    const { analytics } = host.settings();
    void post({
      op: 'feedback',
      sessionId: chat().sessionId,
      traceId: target.traceId,
      value,
      analytics,
    }).catch(() => undefined);
  }

  return {
    restore,
    ask,
    answerRequest,
    stop,
    retry,
    newChat,
    sendFeedback,
    busy: () => controller !== null,
  };
}
