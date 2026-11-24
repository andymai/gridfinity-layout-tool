/**
 * The server's tool set bounds are hand-copied from the client, since api/
 * cannot import src/ at runtime. A client bound changed without this file
 * makes a design that edits fine locally fail at sync or publish.
 */
import { describe, expect, it } from 'vitest';

import { TOOL_SET_CONSTRAINTS } from './toolSetValidation.js';
import {
  TOOL_FAMILY_IDS,
  TOOL_SET_LIMITS,
  TOOL_SET_STYLES,
  TOOL_UNITS,
} from '@/shared/types/toolSet';
import { MAX_CUTOUT_TOOL_SETS } from '@/features/bin-designer/constants/paramMigrationToolSets';

describe('tool set bounds mirror the client', () => {
  it('enums and limits', () => {
    expect(TOOL_SET_CONSTRAINTS.FAMILIES).toEqual(TOOL_FAMILY_IDS);
    expect(TOOL_SET_CONSTRAINTS.UNITS).toEqual(TOOL_UNITS);
    expect(TOOL_SET_CONSTRAINTS.STYLES).toEqual(TOOL_SET_STYLES);
    expect(TOOL_SET_CONSTRAINTS.MAX_SIZES).toBe(TOOL_SET_LIMITS.maxSizes);
    expect(TOOL_SET_CONSTRAINTS.MAX_SIZE_KEY_LENGTH).toBe(TOOL_SET_LIMITS.maxSizeKeyLength);
    expect(TOOL_SET_CONSTRAINTS.MAX_PART_LENGTH).toBe(TOOL_SET_LIMITS.maxPartLength);
    expect(TOOL_SET_CONSTRAINTS.MIN_CLEARANCE_MM).toBe(TOOL_SET_LIMITS.clearanceMm.min);
    expect(TOOL_SET_CONSTRAINTS.MAX_CLEARANCE_MM).toBe(TOOL_SET_LIMITS.clearanceMm.max);
    expect(TOOL_SET_CONSTRAINTS.MIN_LABEL_MM).toBe(TOOL_SET_LIMITS.labelSizeMm.min);
    expect(TOOL_SET_CONSTRAINTS.MAX_LABEL_MM).toBe(TOOL_SET_LIMITS.labelSizeMm.max);
    expect(TOOL_SET_CONSTRAINTS.MAX_SETS).toBe(MAX_CUTOUT_TOOL_SETS);
  });
});
