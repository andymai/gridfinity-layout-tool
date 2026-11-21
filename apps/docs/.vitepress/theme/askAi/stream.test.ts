import { describe, expect, it } from 'vitest';
import { readEvents } from './stream';
import type { StreamEvent } from './stream';

function body(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function all(chunks: string[]): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of readEvents(body(chunks))) events.push(event);
  return events;
}

describe('readEvents', () => {
  it('keeps a character that a chunk boundary splits', async () => {
    const bytes = new TextEncoder().encode('event: text\ndata: {"text":"×"}\n\n');
    const cut = bytes.indexOf(0xc3) + 1;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    const events: StreamEvent[] = [];
    for await (const event of readEvents(stream)) events.push(event);
    expect(events).toEqual([{ event: 'text', data: { text: '×' } }]);
  });

  it('parses events split across chunks', async () => {
    expect(
      await all(['event: start\ndata: {"traceId":"t"}\n\nevent: te', 'xt\ndata: {"text":"Hi"}\n\n'])
    ).toEqual([
      { event: 'start', data: { traceId: 't' } },
      { event: 'text', data: { text: 'Hi' } },
    ]);
  });

  it('skips a block that is not JSON, and an unfinished last block', async () => {
    expect(
      await all(['event: text\ndata: oops\n\nevent: done\ndata: {}\n\nevent: text\ndata: {"a"'])
    ).toEqual([{ event: 'done', data: {} }]);
  });
});
