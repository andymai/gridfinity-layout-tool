import { useSettingsStore } from '@/core/store/settings';
import type { UserSettings } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import type { ToastAction, ToastType } from '@/core/store/toast';
import { getStaticTranslation as t } from '@/i18n';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { allowExportFolder, saveToExportFolder } from './exportFolder';
import { readUrlTarget, sendFailureMessage, sendToUrl } from './sendToUrl';

const FOLDER_TOAST = 'export-destination-folder';
const URL_TOAST = 'export-destination-url';
/** Exports this close together share one toast that counts them. */
const STREAK_MS = 5000;

const streaks = new Map<string, { count: number; at: number }>();

function nextInStreak(key: string): number {
  const now = Date.now();
  const last = streaks.get(key);
  const count = last && now - last.at < STREAK_MS ? last.count + 1 : 1;
  streaks.set(key, { count, at: now });
  return count;
}

function toast(key: string, type: ToastType, message: string, action?: ToastAction): void {
  if (type === 'error') streaks.delete(key);
  useToastStore
    .getState()
    .addToast({ key, type, message, action, duration: type === 'error' ? 8000 : 3000 });
}

function openSettingsAction(): ToastAction {
  return {
    label: t('settings.title'),
    onClick: () => {
      window.dispatchEvent(new CustomEvent('open-settings-modal', { detail: { tab: 'exports' } }));
    },
  };
}

function reportSaved(folder: string, file: string): void {
  const count = nextInStreak(FOLDER_TOAST);
  const message =
    count === 1
      ? t('exportDestination.saved', { folder, file })
      : t('exportDestination.savedMany', { folder, count });
  toast(FOLDER_TOAST, 'success', message);
}

async function saveOrDownload(blob: Blob, fileName: string, folder: string): Promise<void> {
  const outcome = await saveToExportFolder(blob, fileName);
  if (outcome === 'saved') {
    reportSaved(folder, fileName);
    return;
  }
  triggerDownload(blob, fileName);
  if (outcome === 'failed') {
    toast(
      FOLDER_TOAST,
      'error',
      t('exportDestination.folderFailed', { folder }),
      openSettingsAction()
    );
    return;
  }
  toast(FOLDER_TOAST, 'error', t('exportDestination.folderDenied', { folder }), {
    label: t('exportDestination.folder.allowAgain'),
    onClick: async () => {
      if ((await allowExportFolder()) && (await saveToExportFolder(blob, fileName)) === 'saved') {
        reportSaved(folder, fileName);
      }
    },
  });
}

async function send(blob: Blob, fileName: string, settings: UserSettings): Promise<void> {
  const target = readUrlTarget(settings);
  if (!target) {
    toast(URL_TOAST, 'error', t('exportDestination.fail.invalid'), openSettingsAction());
    return;
  }
  const host = target.url.host;
  const result = await sendToUrl(blob, fileName, target);
  if (!result.ok) {
    toast(URL_TOAST, 'error', sendFailureMessage(result, host, t), openSettingsAction());
    return;
  }
  const count = nextInStreak(URL_TOAST);
  toast(
    URL_TOAST,
    'info',
    count === 1
      ? t('exportDestination.sent', { host })
      : t('exportDestination.sentMany', { host, count })
  );
}

/**
 * Hand a finished export to the user: download it, or write it into the
 * chosen folder instead, and also POST it to the configured URL. With both
 * destinations off this is exactly `triggerDownload`, synchronously.
 */
export async function deliverExport(blob: Blob, fileName: string): Promise<void> {
  const settings = useSettingsStore.getState().settings;
  const folder = settings.exportFolderName;
  if (folder === null) triggerDownload(blob, fileName);
  const sending = settings.exportUrlEnabled ? send(blob, fileName, settings) : undefined;
  if (folder !== null) await saveOrDownload(blob, fileName, folder);
  await sending;
}
