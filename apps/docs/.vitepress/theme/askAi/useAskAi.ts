import { nextTick, onBeforeUnmount, onMounted, reactive, watchEffect } from 'vue';
import { createSession } from '@/agent/client/session';
import type {
  BrowserCall,
  Exchange,
  NoticeCode,
  PreparedCall,
  SessionState,
} from '@/agent/client/session';
import { readerSettings } from './consent';
import { ASK_AI_PUBLIC, DOCKED_CLASS, DOCK_QUERY, OFF_KEY, PREVIEW_KEY } from './flags';

export { isLive } from '@/agent/client/session';
export type { Exchange, ReaderRequest, StepKind } from '@/agent/client/session';

const ENDPOINT = '/api/docs-ask';
const CHAT_KEY = 'gridfinity-docs:ask-ai';

const NOTICES: Readonly<Record<NoticeCode, string>> = {
  refusal: 'Ask AI cannot answer this question. Ask it in another way, or search the docs.',
  truncated: 'The answer stopped before its end. Ask again for a shorter answer.',
  resting: 'Ask AI is off until tomorrow. You can still search the docs.',
  rateLimited: 'You asked many questions in the last hour. Try again later.',
  tooLong: 'This chat is too long. Start a new chat.',
  busy: 'Ask AI is busy. Try again in a minute.',
  expired: 'This request waited too long. Ask your question again.',
  failed: 'Ask AI did not answer. Try again.',
  appliedRetry:
    'Ask AI applied the changes, but its answer did not arrive. Retry gets the answer without changing the layout again.',
  appliedNoAnswer:
    'Ask AI applied the changes, but its answer did not arrive. One Undo reverts the changes.',
};

export const noticeText = (code: NoticeCode | null): string | null =>
  code === null ? null : NOTICES[code];

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

function store(kind: 'session' | 'local'): Storage | null {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function unavailable(call: BrowserCall): PreparedCall {
  return { id: call.id, title: 'Your data', preview: null, data: null, unavailable: true };
}

async function prepareCalls(calls: readonly BrowserCall[]): Promise<PreparedCall[]> {
  try {
    const { prepareRead } = await import('./reads');
    return await Promise.all(calls.map(prepareRead));
  } catch {
    return calls.map(unavailable);
  }
}

// Vue tracks the writes to the reactive state, so the session needs no hook.
const chat = createSession({
  state: askAi as SessionState,
  changed: () => undefined,
  endpoint: ENDPOINT,
  storageKey: CHAT_KEY,
  storage: () => store('session'),
  settings: () => readerSettings(store('local')),
  prepareCalls,
  declinedLabel: () => 'Not shared',
  newId: () => crypto.randomUUID(),
});

function rememberOff(off: boolean): void {
  try {
    if (off) store('local')?.setItem(OFF_KEY, '1');
    else store('local')?.removeItem(OFF_KEY);
  } catch {
    // Without the flag, a page only shifts once more while Ask AI is off.
  }
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
  chat.restore();
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

export const busy = (): boolean => chat.busy();
export const ask = (question: string, page: string): Promise<void> => chat.ask(question, page);
export const answerRequest = (target: Exchange, allow: boolean): Promise<void> =>
  chat.answerRequest(target, { reads: allow });
export const stop = (): void => chat.stop();
export const retry = (page: string): Promise<void> => chat.retry(page);
export const newChat = (): void => chat.newChat();
export const sendFeedback = (target: Exchange, value: 1 | -1): void =>
  chat.sendFeedback(target, value);
