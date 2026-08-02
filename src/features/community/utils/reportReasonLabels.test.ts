import { describe, it, expect } from 'vitest';
import { COMMUNITY_REPORT_REASONS } from '@/shared/types/community';
import { REPORT_REASON_LABEL_KEYS } from './reportReasonLabels';

describe('REPORT_REASON_LABEL_KEYS', () => {
  it('maps every report reason to a community.report.reason.* key', () => {
    for (const reason of COMMUNITY_REPORT_REASONS) {
      expect(REPORT_REASON_LABEL_KEYS[reason]).toBe(`community.report.reason.${reason}`);
    }
  });
});
