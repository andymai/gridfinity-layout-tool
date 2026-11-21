/**
 * The loop runs against scripted stream rounds, since CI holds no API key and
 * a test must not spend credits. Each round is the event stream and the final
 * message that the SDK's stream would give.
 */
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { MODEL, runAgent } from './agent.js';
import type { AgentEvent, AgentOptions, AgentProgress, RoundBudget } from './agent.js';
import type { AskCorpus } from './corpus.js';
import { createToolRunner, toolDefinitions } from './tools.js';

const corpus: AskCorpus = {
  version: 'test',
  map: 'the page map',
  pages: {
    '/layouts/layers': {
      group: 'Layouts',
      title: 'Work in layers',
      url: 'https://gridfinitylayouttool.com/docs/layouts/layers',
      markdown: '# Work in layers {#layers}\n\nLayers stack bins.',
      labels: [],
    },
  },
};

interface Round {
  readonly events: unknown[];
  readonly content: unknown[];
  readonly stopReason: string;
}

const usage = {
  input_tokens: 1000,
  output_tokens: 100,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};
const readCall = {
  type: 'tool_use',
  id: 'toolu_1',
  name: 'read_page',
  input: { link: '/layouts/layers' },
};
const toolRound: Round = {
  events: [{ type: 'content_block_start', index: 0, content_block: readCall }],
  content: [readCall],
  stopReason: 'tool_use',
};
const answerRound: Round = {
  events: [
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'thinking_delta', thinking: 'The page says.' },
    },
    {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'text_delta', text: 'Layers stack bins.' },
    },
  ],
  content: [{ type: 'text', text: 'Layers stack bins.' }],
  stopReason: 'end_turn',
};

function scripted(rounds: (Round | Error)[]) {
  const calls: Anthropic.Beta.MessageCreateParamsStreaming[] = [];
  let next = 0;
  const stream = vi.fn((params: Anthropic.Beta.MessageCreateParamsStreaming) => {
    calls.push(structuredClone(params));
    const round = rounds[next++];
    if (round === undefined) throw new Error('no round left');
    if (round instanceof Error) {
      return {
        async *[Symbol.asyncIterator]() {
          yield* [];
          throw round;
        },
        finalMessage: () => Promise.reject(round),
      };
    }
    return {
      async *[Symbol.asyncIterator]() {
        yield* round.events;
      },
      finalMessage: () =>
        Promise.resolve({
          id: `msg_${next}`,
          model: MODEL,
          usage,
          content: round.content,
          stop_reason: round.stopReason,
        }),
    };
  });
  const client = { beta: { messages: { stream } } } as unknown as Anthropic;
  return { client, calls };
}

function budget(open: () => boolean = () => true) {
  return {
    reserve: vi.fn(async () => open()),
    charge: vi.fn(async (_usd: number) => {}),
    release: vi.fn(async () => {}),
  } satisfies RoundBudget;
}

function options(
  client: Anthropic,
  events: AgentEvent[],
  roundBudget: RoundBudget = budget(),
  progress: AgentProgress = { generations: [], steps: [], links: [] }
): AgentOptions {
  return {
    client,
    corpus,
    tools: toolDefinitions(corpus),
    messages: [{ role: 'user', content: 'How do layers work?' }],
    locale: 'en',
    run: createToolRunner(corpus, () => ({}), {}),
    send: (event) => events.push(event),
    budget: roundBudget,
    progress,
    signal: new AbortController().signal,
  };
}

describe('runAgent', () => {
  it('runs a tool, sends the steps, and answers in the next round', async () => {
    const { client, calls } = scripted([toolRound, answerRound]);
    const events: AgentEvent[] = [];
    const held = budget();
    const result = await runAgent(options(client, events, held));

    expect(events.map((e) => (e.type === 'step' ? `step:${e.state}:${e.label}` : e.type))).toEqual([
      'step:running:Opening a page',
      'message',
      'step:done:Reading Layouts › Work in layers',
      'thinking',
      'text',
      'message',
    ]);
    expect(result).toMatchObject({
      answer: 'Layers stack bins.',
      steps: ['Reading Layouts › Work in layers'],
      links: ['/layouts/layers'],
      stopReason: 'end_turn',
    });
    expect(result.generations).toHaveLength(2);
    expect(held.charge).toHaveBeenCalledTimes(2);
    expect(held.reserve).toHaveBeenCalledTimes(2);
    expect(held.release).toHaveBeenCalledTimes(2);
    expect(calls[1]?.messages.at(-1)).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: corpus.pages['/layouts/layers']?.markdown,
        },
      ],
    });
  });

  it('asks with the cache, the fallback and the thinking binding', async () => {
    const { client, calls } = scripted([answerRound]);
    await runAgent(options(client, []));
    expect(calls[0]).toMatchObject({
      model: MODEL,
      fallbacks: 'default',
      cache_control: { type: 'ephemeral' },
      thinking: {
        type: 'adaptive',
        display: 'summarized',
        block_binding: { prefix_mismatch_behavior: 'drop_block' },
      },
      system: [
        { type: 'text' },
        { type: 'text', text: 'the page map', cache_control: { type: 'ephemeral' } },
      ],
    });
    expect(calls[0]?.betas).toEqual([
      'thinking-binding-controls-2026-08-01',
      'server-side-fallback-2026-07-01',
    ]);
    expect(calls[0]?.tool_choice).toBeUndefined();
  });

  it('stops on a refusal and runs no tool from that round', async () => {
    const { client, calls } = scripted([{ ...toolRound, stopReason: 'refusal' }]);
    const events: AgentEvent[] = [];
    const result = await runAgent(options(client, events));
    expect(events.at(-1)).toEqual({ type: 'notice', code: 'refusal' });
    expect(result.steps).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('never runs a tool call cut off at max_tokens', async () => {
    const { client } = scripted([{ ...toolRound, stopReason: 'max_tokens' }]);
    const events: AgentEvent[] = [];
    expect((await runAgent(options(client, events))).steps).toEqual([]);
    expect(events.at(-1)).toEqual({ type: 'notice', code: 'truncated' });
  });

  it('forbids tools in the last round, so a long search still answers', async () => {
    const { client, calls } = scripted([
      toolRound,
      toolRound,
      toolRound,
      toolRound,
      toolRound,
      answerRound,
    ]);
    await runAgent(options(client, []));
    expect(calls).toHaveLength(6);
    expect(calls[4]?.tool_choice).toBeUndefined();
    expect(calls[5]?.tool_choice).toEqual({ type: 'none' });
  });

  it('tries a round again after a dropped stream', async () => {
    const { client, calls } = scripted([new Error('socket hang up'), answerRound]);
    expect((await runAgent(options(client, []))).answer).toBe('Layers stack bins.');
    expect(calls).toHaveLength(2);
  });

  it('stops between rounds once the day reaches the cap', async () => {
    const { client, calls } = scripted([toolRound, answerRound]);
    const events: AgentEvent[] = [];
    let rounds = 0;
    await runAgent(
      options(
        client,
        events,
        budget(() => rounds++ < 1)
      )
    );
    expect(calls).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: 'notice', code: 'resting' });
  });

  it('charges a round that fails after the stream started', async () => {
    const started = {
      type: 'message_start',
      message: { model: MODEL, usage: { ...usage, output_tokens: 0 } },
    };
    const delta = { type: 'message_delta', delta: {}, usage: { output_tokens: 40 } };
    const client = {
      beta: {
        messages: {
          stream: () => ({
            async *[Symbol.asyncIterator]() {
              yield* [started, delta];
              throw new Anthropic.APIConnectionError({ message: 'reset' });
            },
            finalMessage: () => Promise.reject(new Error('never')),
          }),
        },
      },
    } as unknown as Anthropic;
    const held = budget();
    await expect(runAgent(options(client, [], held))).rejects.toThrow('reset');
    expect(held.charge).toHaveBeenCalledTimes(1);
    expect(held.charge.mock.calls[0]?.[0]).toBeCloseTo((1000 * 4 + 40 * 20) / 1_000_000);
    expect(held.release).toHaveBeenCalledTimes(1);
  });

  it('does not try a round again once the reader has seen part of it', async () => {
    const partly: Round = { ...answerRound, events: answerRound.events.slice(1) };
    const { client, calls } = scripted([partly, answerRound]);
    const stream = client.beta.messages.stream as unknown as ReturnType<typeof vi.fn>;
    stream.mockImplementationOnce(() => ({
      async *[Symbol.asyncIterator]() {
        yield* partly.events;
        throw new Error('socket hang up');
      },
      finalMessage: () => Promise.reject(new Error('never')),
    }));
    await expect(runAgent(options(client, []))).rejects.toThrow('socket hang up');
    expect(calls).toHaveLength(0);
  });

  it('keeps the finished rounds of an answer that fails later', async () => {
    const { client } = scripted([
      toolRound,
      new Error('first'),
      new Error('second'),
      new Error('third'),
    ]);
    const progress: AgentProgress = { generations: [], steps: [], links: [] };
    await expect(runAgent(options(client, [], budget(), progress))).rejects.toThrow('third');
    expect(progress.generations).toHaveLength(1);
    expect(progress.steps).toEqual(['Reading Layouts › Work in layers']);
  });
});
