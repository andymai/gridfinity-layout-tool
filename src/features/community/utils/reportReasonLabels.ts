import type { CommunityReportReason } from '@/shared/types/community';

/**
 * i18n label key per report reason, shared by the report dialog's radio list
 * and the owner-facing hidden-state explanation on the detail view.
 */
export const REPORT_REASON_LABEL_KEYS: Record<CommunityReportReason, string> = {
  inappropriate: 'community.report.reason.inappropriate',
  spam: 'community.report.reason.spam',
  broken: 'community.report.reason.broken',
  stolen: 'community.report.reason.stolen',
};
