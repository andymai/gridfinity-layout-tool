import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { CONSTRAINTS } from '@/core/constants';
import { clearAllAppData } from '@/core/storage/clearAppData';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useStorageInfo } from './useStorageInfo';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UsageBarProps {
  percent: number;
  warn: boolean;
}

function UsageBar({ percent, warn }: UsageBarProps) {
  return (
    <div
      className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${
          warn ? 'bg-warning' : 'bg-accent'
        }`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export function StorageTab() {
  const t = useTranslation();
  const info = useStorageInfo();

  const layoutWarn = info.layoutCount >= CONSTRAINTS.LAYOUTS_WARNING_THRESHOLD;
  const localStorageWarn = info.localStoragePercent >= 80;

  const isHealthy = info.backend === 'indexeddb';

  let statusDotColor = 'bg-content-disabled';
  let statusLabel = t('common.loading');
  if (!info.loading) {
    statusDotColor = isHealthy ? 'bg-success' : 'bg-warning';
    statusLabel = isHealthy
      ? t('settings.storage.statusHealthy')
      : t('settings.storage.statusLimited');
  }

  return (
    <div className="space-y-8">
      {/* Storage Status */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">
          {t('settings.storage.status')}
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-block w-2 h-2 rounded-full ${statusDotColor}`} />
          <span className="text-content">{statusLabel}</span>
        </div>
        {!info.loading && (
          <p className="text-xs text-content-disabled mt-1">
            {isHealthy
              ? t('settings.storage.statusHealthyHint')
              : t('settings.storage.statusLimitedHint')}
          </p>
        )}
      </section>

      {/* Layout Count */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">
          {t('settings.storage.layouts')}
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-content-secondary">
              {t('settings.storage.layoutCount', { count: info.layoutCount })}
            </span>
            <span className={layoutWarn ? 'text-warning font-medium' : 'text-content-disabled'}>
              {t('settings.storage.layoutMax', { max: CONSTRAINTS.LAYOUTS_MAX })}
            </span>
          </div>
          <UsageBar
            percent={(info.layoutCount / CONSTRAINTS.LAYOUTS_MAX) * 100}
            warn={layoutWarn}
          />
        </div>
      </section>

      {/* Database Size (only shown when IndexedDB is active) */}
      {info.backend === 'indexeddb' && info.indexedDBBytes !== null && (
        <section>
          <h3 className="text-base font-semibold text-content mb-3">
            {t('settings.storage.databaseSize')}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-content-secondary">{formatBytes(info.indexedDBBytes)}</span>
              {info.quotaBytes !== null && (
                <span className="text-content-disabled">
                  {t('settings.storage.quotaOf', { quota: formatBytes(info.quotaBytes) })}
                </span>
              )}
            </div>
            {info.quotaBytes !== null && (
              <UsageBar
                percent={(info.indexedDBBytes / info.quotaBytes) * 100}
                warn={info.indexedDBBytes / info.quotaBytes > 0.8}
              />
            )}
          </div>
          <p className="text-xs text-content-disabled mt-2">
            {t('settings.storage.databaseSizeHint')}
          </p>
        </section>
      )}

      {/* Settings Cache */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">
          {t('settings.storage.settingsCache')}
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-content-secondary">
              {t('settings.storage.percentUsed', { percent: info.localStoragePercent })}
            </span>
            <span
              className={localStorageWarn ? 'text-warning font-medium' : 'text-content-disabled'}
            >
              {t('settings.storage.settingsCacheLimit')}
            </span>
          </div>
          <UsageBar percent={info.localStoragePercent} warn={localStorageWarn} />
        </div>
        <p className="text-xs text-content-disabled mt-2">
          {t('settings.storage.settingsCacheNote')}
        </p>
      </section>

      {/* Danger Zone */}
      <section>
        <h3 className="text-base font-semibold text-error mb-3">
          {t('settings.storage.dangerZone')}
        </h3>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-content">{t('settings.storage.clearAllData')}</span>
            <p className="text-xs text-content-disabled mt-0.5">
              {t('settings.storage.clearAllDataHint')}
            </p>
          </div>
          <ClearAllDataButton />
        </div>
      </section>
    </div>
  );
}

function ClearAllDataButton() {
  const t = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = () => {
    clearAllAppData();
    // Force reload to reset all in-memory state (Zustand stores, caches, etc.)
    // This is the only reliable way to ensure no stale data writes back.
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        className="px-3 py-1.5 text-sm rounded-md border border-error text-error hover:bg-error/10 transition-colors"
        onClick={() => setShowConfirm(true)}
      >
        {t('settings.storage.clearAllData')}
      </button>
      <ConfirmDialog
        isOpen={showConfirm}
        title={t('settings.storage.clearAllData')}
        message={t('settings.storage.confirmClearAll')}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        destructive
      />
    </>
  );
}
