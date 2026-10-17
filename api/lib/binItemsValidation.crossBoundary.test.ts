/**
 * The server's item caps are hand-copied from the client, since api/ cannot
 * import src/ at runtime. A client cap raised without this file makes every
 * synced or shared item past the old one silently vanish.
 */
import { describe, expect, it } from 'vitest';

import { SHARE_CONSTRAINTS } from './shareConstraints.js';
import { CONSTRAINTS } from '@/core/constants';

describe('bin item caps mirror the client', () => {
  it('per bin, per field', () => {
    expect(SHARE_CONSTRAINTS.ITEMS_PER_BIN_MAX).toBe(CONSTRAINTS.ITEMS_PER_BIN_MAX);
    expect(SHARE_CONSTRAINTS.ITEM_NAME_MAX_LENGTH).toBe(CONSTRAINTS.ITEM_NAME_MAX_LENGTH);
    expect(SHARE_CONSTRAINTS.ITEM_NOTE_MAX_LENGTH).toBe(CONSTRAINTS.ITEM_NOTE_MAX_LENGTH);
    expect(SHARE_CONSTRAINTS.ITEM_QTY_MAX).toBe(CONSTRAINTS.ITEM_QTY_MAX);
  });
});
