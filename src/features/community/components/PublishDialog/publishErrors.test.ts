import { describe, expect, it } from 'vitest';
import type { CommunityClientError } from '../../api/client';
import { presentPublishError } from './publishErrors';

function validation(code: string): CommunityClientError {
  return { kind: 'validation', code, message: 'server text' };
}

describe('presentPublishError', () => {
  it.each([
    ['INVALID_NAME', 'name'],
    ['NAME_TOO_SHORT', 'name'],
    ['NAME_PLACEHOLDER', 'name'],
    ['NAME_LOW_EFFORT', 'name'],
    ['DUPLICATE_DESIGN', 'name'],
    ['INVALID_DESCRIPTION', 'description'],
    ['INVALID_CATEGORY', 'category'],
    ['INVALID_AUTHOR_NAME', 'publicName'],
  ])('routes %s to the %s field', (code, field) => {
    expect(presentPublishError(validation(code)).field).toBe(field);
  });

  it.each(['CUTOUT_REQUIRED', 'REMIX_UNCHANGED', 'UNDER_REVIEW', 'PUBLISH_IN_PROGRESS'])(
    'keeps %s at the banner level',
    (code) => {
      expect(presentPublishError(validation(code)).field).toBeNull();
    }
  );

  it('falls back to the generic banner for an unmapped code', () => {
    // Server messages are English-only, so an unknown code must not be shown.
    const presented = presentPublishError(validation('SOMETHING_NEW'));
    expect(presented.field).toBeNull();
    expect(presented.messageKey).toBe('community.publish.error.generic');
  });

  it('offers sign-in only for an auth failure', () => {
    expect(presentPublishError({ kind: 'needsAuth' }).needsAuth).toBe(true);
    expect(presentPublishError({ kind: 'server' }).needsAuth).toBe(false);
  });

  it('offers dropping the remix link only for an invalid lineage', () => {
    expect(presentPublishError(validation('INVALID_LINEAGE')).canDropRemix).toBe(true);
    expect(presentPublishError(validation('REMIX_UNCHANGED')).canDropRemix).toBe(false);
  });

  it('marks transient failures retryable and permanent ones not', () => {
    expect(presentPublishError({ kind: 'network' }).retryable).toBe(true);
    expect(presentPublishError({ kind: 'server' }).retryable).toBe(true);
    expect(presentPublishError(validation('PUBLISH_IN_PROGRESS')).retryable).toBe(true);
    expect(presentPublishError({ kind: 'disabled' }).retryable).toBe(false);
    expect(presentPublishError(validation('NAME_LOW_EFFORT')).retryable).toBe(false);
  });

  it('carries the retry delay through when the server supplies one', () => {
    const presented = presentPublishError({ kind: 'rateLimited', retryAfterSeconds: 90 });
    expect(presented.messageKey).toBe('community.publish.error.rateLimitedWait');
    expect(presented.values).toEqual({ seconds: 90 });
  });

  it('omits the delay interpolation when the server gives none', () => {
    const presented = presentPublishError({ kind: 'rateLimited', retryAfterSeconds: null });
    expect(presented.messageKey).toBe('community.publish.error.rateLimited');
    expect(presented.values).toBeUndefined();
  });

  it('does not guess a field for a content-filter rejection', () => {
    // The filter does not say which field tripped it.
    expect(presentPublishError({ kind: 'contentBlocked', message: '' }).field).toBeNull();
  });
});
