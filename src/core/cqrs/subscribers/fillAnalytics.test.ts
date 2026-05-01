import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEventBus } from '../bus/eventBus';
import type { EventBus } from '../bus/eventBus';
import type { DomainEvent } from '../events';
import { eventId, correlationId, commandId } from '../types';
import { layerId, categoryId, binId, gridUnits, heightUnits } from '@/core/types';
import type { Bin } from '@/core/types';
import { connectFillAnalytics } from './fillAnalytics';

vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: { trackFill: vi.fn() },
}));
vi.mock('@/shared/analytics/posthog', () => ({
  markFeatureUsed: vi.fn(),
  trackFillOperation: vi.fn(),
  trackBinCreated: vi.fn(),
}));

import { mlTracking } from '@/shared/analytics/useMLTracking';
import { markFeatureUsed, trackFillOperation, trackBinCreated } from '@/shared/analytics/posthog';

function makeBin(idStr: string): Bin {
  return {
    id: binId(idStr),
    layerId: layerId('layer_1'),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1),
    depth: gridUnits(1),
    height: heightUnits(3),
    category: categoryId('cat_1'),
    label: '',
    notes: '',
  };
}

function makeFillEvent(
  fillType: 'uniform' | 'gaps' | undefined,
  bins: Bin[],
  width?: number,
  depth?: number
): DomainEvent {
  return {
    type: 'bin.layerFilled',
    payload: {
      layerId: layerId('layer_1'),
      binsCreated: bins.length,
      bins,
      ...(fillType ? { fillType } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(depth !== undefined ? { depth } : {}),
    },
    meta: {
      id: eventId('evt_1'),
      timestamp: 0,
      correlationId: correlationId('cor_1'),
      commandId: commandId('cmd_1'),
      aggregateId: layerId('layout_1'),
      version: 1,
      schemaVersion: 1,
    },
  } as DomainEvent;
}

describe('fillAnalytics subscriber', () => {
  let bus: EventBus;
  let unsubscribe: () => void;

  beforeEach(() => {
    bus = createEventBus();
    unsubscribe = connectFillAnalytics(bus);
    vi.clearAllMocks();
  });

  afterEach(() => {
    unsubscribe();
    bus.clear();
  });

  it('forwards uniform fills to mlTracking + posthog', () => {
    bus.publish(makeFillEvent('uniform', [makeBin('b_1'), makeBin('b_2')], 1, 1));

    expect(mlTracking.trackFill).toHaveBeenCalledWith('uniform', 2, layerId('layer_1'), {
      width: 1,
      depth: 1,
    });
    expect(markFeatureUsed).toHaveBeenCalledWith('fill');
    expect(trackFillOperation).toHaveBeenCalledWith('fill_layer', 2);
    expect(trackBinCreated).toHaveBeenCalledWith({
      method: 'fill_layer',
      count: 2,
      width: 1,
      depth: 1,
      height: 3,
    });
  });

  it('forwards gap fills with no width/depth dimensions', () => {
    bus.publish(makeFillEvent('gaps', [makeBin('b_1')]));

    expect(mlTracking.trackFill).toHaveBeenCalledWith('gaps', 1, layerId('layer_1'), undefined);
    // markFeatureUsed('fill') fires for ALL fill types — assert here too
    // to catch a silent regression if it gets accidentally moved into a
    // uniform-only branch.
    expect(markFeatureUsed).toHaveBeenCalledWith('fill');
    expect(trackFillOperation).toHaveBeenCalledWith('fill_gaps', 1);
    expect(trackBinCreated).toHaveBeenCalledWith({ method: 'fill_gaps', count: 1 });
  });

  it('ignores events without fillType (pre-v2 persisted events)', () => {
    bus.publish(makeFillEvent(undefined, [makeBin('b_1')]));

    expect(mlTracking.trackFill).not.toHaveBeenCalled();
    expect(markFeatureUsed).not.toHaveBeenCalled();
  });

  it('ignores events with empty bins array', () => {
    bus.publish(makeFillEvent('uniform', [], 1, 1));

    expect(mlTracking.trackFill).not.toHaveBeenCalled();
  });
});
