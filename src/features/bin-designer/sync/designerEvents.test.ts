import { describe, it, expect, beforeEach } from 'vitest';
import { __resetForTests, emit, subscribe, type DesignerEvent } from './designerEvents';
import { designId } from '@/core/types';

beforeEach(() => {
  __resetForTests();
});

describe('designerEvents', () => {
  it('delivers events to all subscribers', () => {
    const a: DesignerEvent[] = [];
    const b: DesignerEvent[] = [];
    subscribe((e) => a.push(e));
    subscribe((e) => b.push(e));

    emit({ type: 'put', id: designId('d1'), updatedAt: '2026-01-01T00:00:00.000Z' });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('unsubscribe stops further deliveries', () => {
    const seen: DesignerEvent[] = [];
    const off = subscribe((e) => seen.push(e));
    off();
    emit({ type: 'put', id: designId('d1'), updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(seen).toEqual([]);
  });

  it('a throwing subscriber does not block the others or the emitter', () => {
    const seen: DesignerEvent[] = [];
    subscribe(() => {
      throw new Error('bad subscriber');
    });
    subscribe((e) => seen.push(e));

    expect(() =>
      emit({ type: 'delete', id: designId('d1'), deletedAt: '2026-01-01T00:00:00.000Z' })
    ).not.toThrow();
    expect(seen).toHaveLength(1);
  });

  it('preserves event shape (put / delete discriminator)', () => {
    const seen: DesignerEvent[] = [];
    subscribe((e) => seen.push(e));

    emit({ type: 'put', id: designId('p'), updatedAt: '2026-01-01T00:00:00.000Z' });
    emit({ type: 'delete', id: designId('d'), deletedAt: '2026-01-02T00:00:00.000Z' });

    expect(seen[0].type).toBe('put');
    expect(seen[1].type).toBe('delete');
  });
});
