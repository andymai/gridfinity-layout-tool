import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAskFeedback, sendAskTrace } from './traces.js';
import type { AskTrace } from './traces.js';

vi.mock('@vercel/functions', () => ({ waitUntil: (promise: Promise<unknown>) => promise }));

const trace: AskTrace = {
  traceId: 'trace-1',
  door: 'docs',
  sessionId: 'chat-1',
  question: 'How do layers work?',
  page: '/layouts/layers',
  locale: 'en',
  corpusVersion: 'v1',
  answer: 'Layers stack bins.',
  steps: ['Reading Layouts › Work in layers'],
  links: ['/layouts/layers'],
  docGap: false,
  latencySeconds: 2,
  error: null,
  generations: [
    {
      spanId: 'msg_1',
      model: 'claude-opus-5-5',
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0.01,
      latencySeconds: 2,
      firstTokenSeconds: 1,
      stopReason: 'end_turn',
      text: 'Layers stack bins.',
      toolCalls: [],
    },
  ],
};

describe('Ask AI traces', () => {
  const bodies: { event: string; properties: Record<string, unknown> }[] = [];

  beforeEach(() => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', 'phc_test');
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string) as (typeof bodies)[number]);
        return Promise.resolve(new Response(null));
      })
    );
  });

  afterEach(() => {
    bodies.length = 0;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('makes no person profile, and sends the pages that the answer read', () => {
    sendAskTrace(trace);
    sendAskFeedback('chat-1', 'trace-1', 1);
    expect(bodies.map((body) => body.event)).toEqual(['$ai_generation', '$ai_trace', '$ai_metric']);
    for (const body of bodies) {
      expect(body.properties).toMatchObject({
        distinct_id: 'chat-1',
        $process_person_profile: false,
      });
    }
    expect(bodies[1]?.properties).toMatchObject({ docs_ask_pages: ['/layouts/layers'] });
  });

  it('sends nothing outside production', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    sendAskTrace(trace);
    expect(bodies).toEqual([]);
  });
});
