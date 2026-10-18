/**
 * The server's slant bounds are hand-copied from the client, since api/ cannot
 * import src/ at runtime. A client ceiling raised without this file makes every
 * synced or shared bin past the old one silently lose its slant.
 */
import { describe, expect, it } from 'vitest';

import { SLANT_MAX_DEG, SLANT_SIDES } from './slantValidation.js';
import { SLANT_MAX_DEG as CLIENT_MAX_DEG, SLANT_SIDES as CLIENT_SIDES } from '@/core/types/slant';

describe('slant bounds mirror the client', () => {
  it('angle ceiling', () => {
    expect(SLANT_MAX_DEG).toBe(CLIENT_MAX_DEG);
  });

  it('sides', () => {
    expect([...SLANT_SIDES]).toEqual([...CLIENT_SIDES]);
  });
});
