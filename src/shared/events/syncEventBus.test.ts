import { describe, it, expect, vi } from 'vitest';
import { onSyncEvent, emitSyncEvent } from './syncEventBus';
import type { DesignSavedEvent, BinResizedEvent } from './syncEventBus';

describe('syncEventBus', () => {
  it('delivers events to matching listeners', () => {
    const handler = vi.fn();
    const unsub = onSyncEvent<DesignSavedEvent>('design-saved', handler);

    const event: DesignSavedEvent = {
      type: 'design-saved',
      designId: 'd1',
      dimensions: { width: 2, depth: 3, height: 5 },
    };
    emitSyncEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
    unsub();
  });

  it('does not deliver events to unsubscribed listeners', () => {
    const handler = vi.fn();
    const unsub = onSyncEvent<DesignSavedEvent>('design-saved', handler);
    unsub();

    emitSyncEvent({
      type: 'design-saved',
      designId: 'd1',
      dimensions: { width: 1, depth: 1, height: 1 },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not cross-deliver between event types', () => {
    const designHandler = vi.fn();
    const resizeHandler = vi.fn();
    const unsub1 = onSyncEvent<DesignSavedEvent>('design-saved', designHandler);
    const unsub2 = onSyncEvent<BinResizedEvent>('bin-resized', resizeHandler);

    emitSyncEvent({
      type: 'design-saved',
      designId: 'd1',
      dimensions: { width: 1, depth: 1, height: 1 },
    });

    expect(designHandler).toHaveBeenCalledTimes(1);
    expect(resizeHandler).not.toHaveBeenCalled();

    unsub1();
    unsub2();
  });

  it('supports multiple listeners for the same event type', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unsub1 = onSyncEvent<DesignSavedEvent>('design-saved', handler1);
    const unsub2 = onSyncEvent<DesignSavedEvent>('design-saved', handler2);

    emitSyncEvent({
      type: 'design-saved',
      designId: 'd1',
      dimensions: { width: 1, depth: 1, height: 1 },
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });
});
