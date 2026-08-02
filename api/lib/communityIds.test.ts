import { createHash } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  COMMUNITY_DESIGN_ID_LENGTH,
  deriveAuthorPublicId,
  generateCommunityDesignId,
} from './communityIds.js';
import { isValidShareId } from './shared.js';

describe('deriveAuthorPublicId', () => {
  beforeEach(() => {
    process.env.TOKEN_SALT = 'test-salt';
  });

  afterEach(() => {
    delete process.env.TOKEN_SALT;
  });

  it('refuses to derive when TOKEN_SALT is unset', () => {
    delete process.env.TOKEN_SALT;
    expect(deriveAuthorPublicId('user-1')).toBeNull();
  });

  it('derives sha256(salt + ":community:" + userId) truncated to 32 hex chars', () => {
    const expected = createHash('sha256')
      .update('test-salt:community:user-1')
      .digest('hex')
      .slice(0, 32);
    expect(deriveAuthorPublicId('user-1')).toBe(expected);
  });

  it('is stable for the same userId and distinct across userIds', () => {
    expect(deriveAuthorPublicId('user-1')).toBe(deriveAuthorPublicId('user-1'));
    expect(deriveAuthorPublicId('user-1')).not.toBe(deriveAuthorPublicId('user-2'));
  });

  it('changes with the salt', () => {
    const first = deriveAuthorPublicId('user-1');
    process.env.TOKEN_SALT = 'other-salt';
    expect(deriveAuthorPublicId('user-1')).not.toBe(first);
  });

  it('is namespaced away from the Ko-fi donor derivation on identical input', () => {
    const donorStyle = createHash('sha256')
      .update('test-salt:kofi:user-1')
      .digest('hex')
      .slice(0, 32);
    expect(deriveAuthorPublicId('user-1')).not.toBe(donorStyle);
  });
});

describe('generateCommunityDesignId', () => {
  it('produces 12-char alphanumeric ids', () => {
    for (let i = 0; i < 50; i++) {
      const id = generateCommunityDesignId();
      expect(id).toMatch(/^[a-zA-Z0-9]{12}$/);
      expect(id).toHaveLength(COMMUNITY_DESIGN_ID_LENGTH);
    }
  });

  it('passes the existing share-id validation', () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidShareId(generateCommunityDesignId())).toBe(true);
    }
  });

  it('does not repeat across a batch', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateCommunityDesignId()));
    expect(ids.size).toBe(200);
  });
});
