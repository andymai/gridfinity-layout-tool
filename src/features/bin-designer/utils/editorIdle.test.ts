import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { editorBuilding, untilEditorIdle } from './editorIdle';

function setStatus(status: 'idle' | 'generating'): void {
  const state = useDesignerStore.getState();
  useDesignerStore.setState({ generation: { ...state.generation, status } });
}

describe('untilEditorIdle', () => {
  beforeEach(() => setStatus('idle'));

  it('resolves at once while the editor is idle', async () => {
    expect(editorBuilding()).toBe(false);
    await expect(untilEditorIdle()).resolves.toBe(true);
  });

  it('waits for a build to end', async () => {
    setStatus('generating');
    let done = false;
    const waiting = untilEditorIdle().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    setStatus('idle');
    await waiting;
    expect(done).toBe(true);
  });

  it('reports false when its bound passes or its caller aborts first', async () => {
    setStatus('generating');
    await expect(untilEditorIdle(undefined, 5)).resolves.toBe(false);
    const controller = new AbortController();
    const waiting = untilEditorIdle(controller.signal);
    controller.abort();
    await expect(waiting).resolves.toBe(false);
  });
});
