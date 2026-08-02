/**
 * Cross-boundary equality test for the category mirror: api/ cannot import
 * from src/, so `COMMUNITY_CATEGORIES` is duplicated in
 * `api/lib/communityValidation.ts` and only this test keeps the two tuples
 * from drifting apart.
 */
import { describe, expect, it } from 'vitest';

import { COMMUNITY_CATEGORIES as API_COMMUNITY_CATEGORIES } from '../../../api/lib/communityValidation.js';

import { COMMUNITY_CATEGORIES } from './community';

describe('COMMUNITY_CATEGORIES (cross-boundary mirror)', () => {
  it('matches the api tuple exactly, including order', () => {
    expect([...COMMUNITY_CATEGORIES]).toEqual([...API_COMMUNITY_CATEGORIES]);
  });
});
