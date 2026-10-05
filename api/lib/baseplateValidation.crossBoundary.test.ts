/**
 * The server's baseplate enum lists are hand-copied from the client, since
 * api/ cannot import src/ at runtime. A value added on the client and not here
 * is silently dropped from every synced or shared plate.
 */
import { describe, expect, it } from 'vitest';

import { CONNECTOR_STYLES, FRACTIONAL_EDGES, PADDING_ANCHORS } from './baseplateValidation.js';
import { PADDING_ANCHOR_VALUES } from '@/core/baseplateDefaults';
import { BASEPLATE_CONNECTOR_STYLES } from '@/shared/types/bin';
import type { FractionalEdge } from '@/core/types';

describe('baseplate enum mirrors', () => {
  it('padding anchors match the client', () => {
    expect(new Set(PADDING_ANCHORS)).toEqual(PADDING_ANCHOR_VALUES);
  });

  it('connector styles match the client', () => {
    expect([...CONNECTOR_STYLES].sort()).toEqual([...BASEPLATE_CONNECTOR_STYLES].sort());
  });

  it('fractional edges match the client type', () => {
    const client: Record<FractionalEdge, true> = { start: true, end: true };
    expect([...FRACTIONAL_EDGES].sort()).toEqual(Object.keys(client).sort());
  });
});
