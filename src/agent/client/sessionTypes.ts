import type { PlanView } from '@/agent/contract';

export type StepKind = 'read' | 'search' | 'check' | 'plan' | 'yours' | 'change';

export interface Step {
  readonly id: string;
  readonly kind: StepKind;
  readonly state: 'running' | 'waiting' | 'done' | 'error';
  /** The label in English, as the server wrote it. */
  readonly label: string;
  /** The label as a key and its values, for a panel that translates it. */
  readonly key?: string;
  readonly vars?: Readonly<Record<string, string>>;
}

/** Which panel asks: the docs site, or the app, where Ask AI can also change a layout. */
export type Door = 'docs' | 'app';

/** What the browser sends back for one call. */
export type CallResult =
  | { readonly callId: string; readonly status: 'shared'; readonly data: unknown }
  | { readonly callId: string; readonly status: 'declined' | 'unavailable' };

/** A browser call as the server asked for it. */
export interface BrowserCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

/**
 * One browser call, run before the reader decides. For a read, `data` is
 * exactly what Allow sends. For a change, `data` is what the panel previews,
 * and Apply sends what the host's `apply` returns.
 */
export interface PreparedCall {
  readonly id: string;
  /** A read of the reader's data (the default), or a change to their layout. */
  readonly kind?: 'read' | 'change';
  readonly title: string;
  /** The text that the model would read, shown in the panel before the reader allows it. */
  readonly preview: string | null;
  readonly data: unknown;
  readonly unavailable: boolean;
  /**
   * Data that goes back whatever the reader does, such as a change that the
   * app refused. A request of only such calls goes back at once.
   */
  readonly settled?: unknown;
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
  | 'refusal'
  | 'truncated'
  | 'resting'
  | 'rateLimited'
  | 'tooLong'
  | 'busy'
  | 'expired'
  | 'failed'
  /** Changes applied, and the answer after them failed; Retry asks for the answer alone. */
  | 'appliedRetry'
  /** Changes applied, and the answer after them cannot come back. */
  | 'appliedNoAnswer';

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
  /** The reader applied changes in this exchange, so asking its question again could repeat them. */
  applied: boolean;
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
  /** Absent for the docs panel. */
  readonly door?: Door;
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
  /** Applies a change that the reader approved, and gives the data that goes back. */
  readonly apply?: (call: PreparedCall) => Promise<unknown>;
  /** The step label of a call that the reader did not allow. */
  readonly declinedLabel: (call: PreparedCall) => string;
  readonly newId: () => string;
}

/**
 * The reader's answer to a request. Reads and changes each take their own
 * yes, so Apply on a change never shares the reader's data with the model.
 * A kind without a yes goes back declined.
 */
export interface RequestAnswer {
  /** Allow: send the reads that the panel showed. */
  readonly reads?: boolean;
  /** Apply: apply the changes, and send what the host's `apply` returns. */
  readonly changes?: boolean;
}

export interface Session {
  /** Shows the chat that this tab kept, when the panel shows none yet. */
  restore(): void;
  ask(question: string, page: string): Promise<void>;
  answerRequest(target: Exchange, answer: RequestAnswer): Promise<void>;
  stop(): void;
  retry(page: string): Promise<void>;
  newChat(): void;
  sendFeedback(target: Exchange, value: 1 | -1): void;
  busy(): boolean;
}
