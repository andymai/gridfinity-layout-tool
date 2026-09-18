import { describe, expect, it } from 'vitest';
import { storageUnavailable } from '@/core/result';
import { syncPersistError } from './persistError';

describe('syncPersistError', () => {
  it('names the failure code in the message', () => {
    const error = syncPersistError('saveDesign', 'baseplate_1', storageUnavailable('indexedDB'));
    expect(error.message).toBe('saveDesign failed for baseplate_1: STORAGE_UNAVAILABLE');
  });

  it('attaches the StorageError as cause so the original DOMException survives', () => {
    const domException = new DOMException('quota', 'QuotaExceededError');
    const storageError = storageUnavailable('indexedDB', domException);
    const error = syncPersistError('saveDesign', 'design_9', storageError);
    expect(error.cause).toBe(storageError);
    expect((error.cause as { cause?: unknown }).cause).toBe(domException);
  });
});
