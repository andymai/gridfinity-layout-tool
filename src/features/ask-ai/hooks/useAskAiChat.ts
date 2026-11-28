import { useEffect, useSyncExternalStore } from 'react';
import type { PreparedCall } from '@/agent/client/session';
import { useSettingsStore } from '@/core/store/settings';
import { useCurrentLocale, useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts';
import { chatSnapshot, setChatBridge, subscribeChat } from '../utils/askAiChat';
import type { ChatSnapshot } from '../utils/askAiChat';
import { applyChange, prepareCalls } from '../utils/browserCalls';

/** The chat as it is now. Each change gives a new snapshot. */
export function useAskAiChat(): ChatSnapshot {
  return useSyncExternalStore(subscribeChat, chatSnapshot);
}

/**
 * Gives the chat what it needs from the app: the reader's language and
 * analytics switch, the stores for reads, and the mutations for Apply. A
 * request that arrives after the panel closes still finds the last bridge.
 */
export function useChatBridge(): void {
  const t = useTranslation();
  const locale = useCurrentLocale();
  const mutations = useMutations();
  useEffect(() => {
    setChatBridge({
      settings: () => ({
        analytics: useSettingsStore.getState().settings.analyticsEnabled,
        locale,
      }),
      prepareCalls: (calls) => prepareCalls(calls, t),
      apply: (call: PreparedCall) => applyChange(call, mutations),
      declinedLabel: (call) =>
        call.kind === 'change' ? t('askAi.step.notApplied') : t('askAi.step.notShared'),
    });
  }, [t, locale, mutations]);
}
