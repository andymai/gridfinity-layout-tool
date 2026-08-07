import type { CommunityPrint } from '@/shared/types/communityPrint';

type FitVerdict = CommunityPrint['fitVerdict'];

export const PRINT_VERDICT_LABEL_KEYS: Record<FitVerdict, string> = {
  'as-designed': 'community.print.fit.asDesigned',
  adjusted: 'community.print.fit.adjusted',
  'did-not-fit': 'community.print.fit.didNotFit',
};

export const PRINT_VERDICT_TONES: Record<FitVerdict, 'success' | 'warning' | 'error'> = {
  'as-designed': 'success',
  adjusted: 'warning',
  'did-not-fit': 'error',
};
