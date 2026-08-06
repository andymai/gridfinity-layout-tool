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
  classifyCommunityDescription as serverClassifyDescription,
  classifyCommunityName as serverClassifyName,
} from '../../../api/lib/communityLowEffort.js';

import {
  classifyCommunityDescription as clientClassifyDescription,
  classifyCommunityName as clientClassifyName,
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

const DESCRIPTION_FIXTURES: readonly string[] = [
  'Holds 14 AA cells upright',
  'For AA cells',
  '  For AA cells  ',
  'M3ネジ用の仕切り付きビン',
  '드라이버 여섯 개를 담는 통',
  '',
  '   ',
  'Bit holder',
  'aaaaaaaaaaaaaa',
  'abababababab',
  '1234567890123',
  '..............',
  'a b c d e f g h',
];

describe('communityLowEffort client and server mirrors agree', () => {
  it.each(NAME_FIXTURES.map((name, index) => [index, name] as const))(
    'name fixture %i',
    (_index, name) => {
      expect(clientClassifyName(name)).toBe(serverClassifyName(name));
    }
  );

  it.each(DESCRIPTION_FIXTURES.map((description, index) => [index, description] as const))(
    'description fixture %i',
    (_index, description) => {
      expect(clientClassifyDescription(description)).toBe(serverClassifyDescription(description));
    }
  );
});
