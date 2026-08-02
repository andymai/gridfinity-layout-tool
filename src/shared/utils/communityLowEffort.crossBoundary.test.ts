/**
 * Cross-boundary equality test for the low-effort predicate mirror.
 *
 * The client copy (`src/shared/utils/communityLowEffort.ts`, used to disable
 * the Publish button) and the server copy (`api/lib/communityLowEffort.ts`, the
 * authority) MUST agree on every input, or the button would enable a submission
 * the server then rejects. This is the node-env `unit` vitest project, which
 * also picks up `api/**\/*.test.ts`, so both sides are importable from one run.
 */
import { describe, expect, it } from 'vitest';

import {
  classifyCommunityName as serverClassifyName,
  hasQualifyingCutout as serverHasCutout,
} from '../../../api/lib/communityLowEffort.js';

import {
  classifyCommunityName as clientClassifyName,
  hasQualifyingCutout as clientHasCutout,
} from './communityLowEffort';

const NAME_FIXTURES: readonly string[] = [
  'Socket Organizer',
  '  Bolt tray  ',
  '工具盒',
  '',
  '   ',
  'ab',
  'abc',
  'Untitled Bin',
  'untitled bin',
  'UNTITLED',
  '1234',
  '-----',
  'aaaa',
  '!!!',
  'a a a',
  'cool <script name',
];

const CUTOUT_FIXTURES: readonly { readonly cutouts?: unknown }[] = [
  { cutouts: [{ shape: 'circle' }] },
  { cutouts: [] },
  {},
  { cutouts: undefined },
  { cutouts: 'not-an-array' },
];

describe('communityLowEffort client and server mirrors agree', () => {
  it.each(NAME_FIXTURES.map((name, index) => [index, name] as const))(
    'name fixture %i',
    (_index, name) => {
      expect(clientClassifyName(name)).toBe(serverClassifyName(name));
    }
  );

  it.each(CUTOUT_FIXTURES.map((params, index) => [index, params] as const))(
    'cutout fixture %i',
    (_index, params) => {
      expect(clientHasCutout(params)).toBe(serverHasCutout(params));
    }
  );
});
