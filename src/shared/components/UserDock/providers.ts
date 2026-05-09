import type { AuthProvider } from '@/core/sync/session/sessionApi';

interface ProviderInfo {
  labelKey: 'auth.providerGoogle' | 'auth.providerGithub';
  hairlineColor: string;
}

export const PROVIDER_INFO: Record<AuthProvider, ProviderInfo> = {
  google: { labelKey: 'auth.providerGoogle', hairlineColor: '#4285F4' },
  github: { labelKey: 'auth.providerGithub', hairlineColor: '#6E5494' },
};
