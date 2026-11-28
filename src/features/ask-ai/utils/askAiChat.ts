import { createSession } from '@/agent/client/session';
import type {
  BrowserCall,
  Exchange,
  PreparedCall,
  Session,
  SessionState,
} from '@/agent/client/session';

import { ASK_AI_ENDPOINT } from '../constants';

const CHAT_KEY = 'gridfinity:ask-ai';

/** What the chat needs from the app at the moment it asks: React context, stores, language. */
export interface ChatBridge {
  settings(): { readonly analytics: boolean; readonly locale: string };
  prepareCalls(calls: readonly BrowserCall[]): Promise<PreparedCall[]>;
  apply(call: PreparedCall): Promise<unknown>;
  declinedLabel(call: PreparedCall): string;
}

export interface ChatSnapshot {
  readonly resting: boolean;
  readonly full: boolean;
  readonly exchanges: readonly Exchange[];
}

let bridge: ChatBridge | null = null;

/** The mounted panel keeps this up to date, so the chat reads the app as it is now. */
export function setChatBridge(next: ChatBridge | null): void {
  bridge = next;
}

const state: SessionState = { resting: false, full: false, exchanges: [] };

// The session writes into `state` in place. React needs a new object for
// each change, or a memoized child keeps showing the old one.
function copy(): ChatSnapshot {
  return {
    resting: state.resting,
    full: state.full,
    exchanges: state.exchanges.map((exchange) => ({
      ...exchange,
      steps: [...exchange.steps],
      plans: { ...exchange.plans },
      request: exchange.request
        ? { ...exchange.request, calls: [...exchange.request.calls] }
        : null,
    })),
  };
}

let snapshot: ChatSnapshot = copy();
const listeners = new Set<() => void>();

function changed(): void {
  snapshot = copy();
  for (const listener of listeners) listener();
}

export function subscribeChat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const chatSnapshot = (): ChatSnapshot => snapshot;

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const unavailable = (call: BrowserCall): PreparedCall => ({
  id: call.id,
  title: '',
  preview: null,
  data: null,
  unavailable: true,
});

let session: Session | null = null;

export function chatSession(): Session {
  session ??= createSession({
    door: 'app',
    state,
    changed,
    endpoint: ASK_AI_ENDPOINT,
    storageKey: CHAT_KEY,
    storage: sessionStore,
    settings: () => bridge?.settings() ?? { analytics: false, locale: 'en' },
    prepareCalls: (calls) =>
      bridge ? bridge.prepareCalls(calls) : Promise.resolve(calls.map(unavailable)),
    apply: (call) =>
      bridge ? bridge.apply(call) : Promise.reject(new Error('Ask AI is not open')),
    declinedLabel: (call) => bridge?.declinedLabel(call) ?? '',
    newId: () => crypto.randomUUID(),
  });
  return session;
}

/** The session's own exchange for a snapshot's copy, which the session's actions take. */
export function liveExchange(id: number): Exchange | undefined {
  return state.exchanges.find((exchange) => exchange.id === id);
}
