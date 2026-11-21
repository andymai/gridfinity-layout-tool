import { SETTINGS_STORAGE_KEY } from '@/core/storage/storageKeys';
import { detectBrowserLocale } from '@/i18n/detection';
import { isLocale } from '@/i18n/types';
import { isTrackingOptOut } from '@/shared/analytics/posthog/privacy';

export interface ReaderSettings {
  readonly analytics: boolean;
  readonly locale: string;
}

/**
 * The reader's analytics switch and language, read the way the app reads its
 * own settings (settings.normalize.ts): the docs share the app's origin, so
 * they see the same storage. Without a stored switch, a GPC or DNT signal
 * turns analytics off.
 */
export function readerSettings(
  storage: Pick<Storage, 'getItem'> | null,
  optOut: () => boolean = isTrackingOptOut,
  browserLocale: () => string = detectBrowserLocale
): ReaderSettings {
  let stored: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    if (typeof parsed === 'object' && parsed !== null) stored = parsed as Record<string, unknown>;
  } catch {
    stored = {};
  }
  const analytics =
    typeof stored.analyticsEnabled === 'boolean' ? stored.analyticsEnabled : !optOut();
  const locale =
    typeof stored.locale === 'string' && isLocale(stored.locale) ? stored.locale : browserLocale();
  return { analytics, locale };
}
