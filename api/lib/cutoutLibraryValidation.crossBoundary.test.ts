/**
 * The library's limits and id formats are copied from the client, since api/
 * cannot import src/ at runtime. A client change without this one makes the
 * server refuse every synced item or folder past it.
 */
import { describe, expect, it } from 'vitest';

import {
  LIBRARY_FOLDER_ID_PATTERN,
  LIBRARY_ITEM_ID_PATTERN,
  LIBRARY_NAME_MAX_LENGTH,
  MIN_PATH_POINTS as SERVER_MIN_PATH_POINTS,
} from './cutoutLibraryValidation.js';
import { MIN_PATH_POINTS } from '@/features/bin-designer/types';
import { getQuotaCaps } from './quota.js';
import {
  LIBRARY_FOLDER_ID_PREFIX,
  LIBRARY_ITEM_ID_PREFIX,
  MAX_LIBRARY_FOLDERS,
  MAX_LIBRARY_ITEMS,
  MAX_LIBRARY_NAME_LENGTH,
} from '@/features/bin-designer/library/libraryTypes';
import { generateUUID } from '@/shared/utils/uuid';

describe('cutout library limits mirror the client', () => {
  it('name length', () => {
    expect(LIBRARY_NAME_MAX_LENGTH).toBe(MAX_LIBRARY_NAME_LENGTH);
  });

  it('ids the client makes pass the server patterns', () => {
    expect(LIBRARY_ITEM_ID_PATTERN.test(`${LIBRARY_ITEM_ID_PREFIX}${generateUUID()}`)).toBe(true);
    expect(LIBRARY_FOLDER_ID_PATTERN.test(`${LIBRARY_FOLDER_ID_PREFIX}${generateUUID()}`)).toBe(
      true
    );
  });

  it('fewest path points', () => {
    expect(SERVER_MIN_PATH_POINTS).toBe(MIN_PATH_POINTS);
  });

  it('counts', () => {
    expect(getQuotaCaps('cutoutItems').maxCount).toBe(MAX_LIBRARY_ITEMS);
    expect(getQuotaCaps('cutoutFolders').maxCount).toBe(MAX_LIBRARY_FOLDERS);
  });
});
