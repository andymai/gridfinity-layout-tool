export type FeedbackCategory = 'feature_request' | 'bug_report' | 'general';

export interface FeedbackContext {
  drawerSize: string;
  binCount: number;
  layerCount: number;
  browser: string;
  halfBinMode: boolean;
  locale: string;
}

export interface FeedbackPayload {
  category: FeedbackCategory;
  description: string;
  email?: string;
  context?: FeedbackContext;
  hp?: string;
}

export interface FeedbackResponse {
  success: boolean;
  error?: string;
}

export const FEEDBACK_CONSTRAINTS = {
  DESCRIPTION_MAX: 2000,
  EMAIL_MAX: 254,
} as const;
