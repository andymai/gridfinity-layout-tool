/**
 * Cross-boundary equality tests for the community mirrors: api/ cannot
 * import from src/, so `COMMUNITY_CATEGORIES` (duplicated in
 * `api/lib/communityValidation.ts`) and `COMMUNITY_INDEX_SORTS` (duplicated
 * in `api/lib/redisKeys.ts`) only stay in lockstep via these tests.
 */
import { describe, expect, it } from 'vitest';

import {
  COMMUNITY_CATEGORIES as API_COMMUNITY_CATEGORIES,
  COMMUNITY_FEATURE_REASONS as API_COMMUNITY_FEATURE_REASONS,
} from '../../../api/lib/communityValidation.js';
import { COMMUNITY_INDEX_SORTS as API_COMMUNITY_INDEX_SORTS } from '../../../api/lib/redisKeys.js';

import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_FEATURE_REASONS,
  COMMUNITY_INDEX_SORTS,
} from './community';

describe('COMMUNITY_CATEGORIES (cross-boundary mirror)', () => {
  it('matches the api tuple exactly, including order', () => {
    expect([...COMMUNITY_CATEGORIES]).toEqual([...API_COMMUNITY_CATEGORIES]);
  });
});

describe('COMMUNITY_INDEX_SORTS (cross-boundary mirror)', () => {
  it('matches the api tuple exactly, including order', () => {
    expect([...COMMUNITY_INDEX_SORTS]).toEqual([...API_COMMUNITY_INDEX_SORTS]);
  });
});

describe('COMMUNITY_FEATURE_REASONS (cross-boundary mirror)', () => {
  it('matches the api tuple exactly, including order', () => {
    expect([...COMMUNITY_FEATURE_REASONS]).toEqual([...API_COMMUNITY_FEATURE_REASONS]);
  });
});
