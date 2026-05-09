import type { AuthProvider } from '@/core/sync/session/sessionApi';

interface ProviderInfo {
  /** Localized display label key fragment ('Google' / 'GitHub'). */
  labelKey: 'auth.providerGoogle' | 'auth.providerGithub';
  /** 1px hairline accent at the top of the dock. Single tasteful tone per
   *  provider — chosen for theme-friendly contrast against surface-secondary. */
  hairlineColor: string;
}

export const PROVIDER_INFO: Record<AuthProvider, ProviderInfo> = {
  google: { labelKey: 'auth.providerGoogle', hairlineColor: '#4285F4' },
  github: { labelKey: 'auth.providerGithub', hairlineColor: '#6E5494' },
};
