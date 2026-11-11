/**
 * A collab room compares the owner's layout with a copy fetched from the share
 * by fingerprint. The share keeps only some layout fields, so the fingerprint
 * must cover only those, or a copy with the same public content reads as a
 * different layout and replaces the room.
 */
import { describe, expect, it } from 'vitest';

import { isValidationError, validateShareLayout, withoutLibraryPlacement } from './validation.js';
import type { Layout } from '@/core/types';
import { baseplateDesignId, binId, mm } from '@/core/types';
import { validateImport } from '@/shared/utils/validationImport';
import { roomLayoutFingerprint } from '@/shared/utils/roomLinkStamp';
import { createTestBin, createTestLayout } from '@/test/testUtils';

function throughShare(layout: Layout): Layout {
  const stored = validateShareLayout(layout, JSON.stringify(layout).length);
  if (isValidationError(stored)) throw new Error(stored.error.message);
  const fetched = JSON.parse(JSON.stringify(withoutLibraryPlacement(stored.layout))) as unknown;
  const imported = validateImport(fetched);
  if (!imported.valid || !imported.layout) throw new Error(imported.errors.join('; '));
  return imported.layout;
}

describe('room fingerprint across a share round trip', () => {
  it('is the same for the owner layout and the copy a visitor fetches', () => {
    const owner: Layout = {
      ...createTestLayout({
        bins: [createTestBin({ id: binId('a'), label: 'Screws', notes: 'M3' })],
      }),
      printBedDepth: mm(220),
      gridUnitMmY: mm(40),
      magnetAnchor: 'center',
      lowProfileBase: true,
      purpose: 'workshop',
      folderId: 'folder_1_abc',
      activeBaseplateId: baseplateDesignId('bp-1'),
    };

    expect(roomLayoutFingerprint(throughShare(owner))).toBe(roomLayoutFingerprint(owner));
  });
});
