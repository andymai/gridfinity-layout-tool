import { isErr } from '@/core/result';
import { useSettingsStore } from '@/core/store/settings';
import type { UserSettings } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import type { ToastAction, ToastType } from '@/core/store/toast';
import { getStaticTranslation as t } from '@/i18n';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { allowExportFolder, saveToExportFolder } from './exportFolder';
import { readUrlTarget, sendFailureMessage, sendToUrl } from './sendToUrl';

// Successes and failures use separate toast keys, so a later success never
// replaces a failure the user has not read yet.
const FOLDER = { done: 'export-folder-saved', failed: 'export-folder-failed' } as const;
const UPLOAD = { done: 'export-url-sent', failed: 'export-url-failed' } as const;
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
  const count = nextInStreak(FOLDER.done);
  const message =
    count === 1
      ? t('exportDestination.saved', { folder, file })
      : t('exportDestination.savedMany', { folder, count });
  toast(FOLDER.done, 'success', message);
}

async function saveOrDownload(blob: Blob, fileName: string, settingsFolder: string) {
  const saved = await saveToExportFolder(blob, fileName);
  if (!isErr(saved)) {
    reportSaved(saved.value, fileName);
    return;
  }
  triggerDownload(blob, fileName);
  const folder = saved.error.folder ?? settingsFolder;
  if (saved.error.reason === 'failed') {
    toast(
      FOLDER.failed,
      'error',
      t('exportDestination.folderFailed', { folder }),
      openSettingsAction()
    );
    return;
  }
  const denied = t('exportDestination.folderDenied', { folder });
  toast(FOLDER.failed, 'error', denied, {
    label: t('exportDestination.folder.allowAgain'),
    onClick: async () => {
      const retried = (await allowExportFolder()) ? await saveToExportFolder(blob, fileName) : null;
      if (retried && !isErr(retried)) reportSaved(retried.value, fileName);
      else toast(FOLDER.failed, 'error', denied, openSettingsAction());
    },
  });
}

async function send(blob: Blob, fileName: string, settings: UserSettings): Promise<void> {
  const target = readUrlTarget(settings);
  if (!target) {
    toast(UPLOAD.failed, 'error', t('exportDestination.fail.invalid'), openSettingsAction());
    return;
  }
  const host = target.url.host;
  const result = await sendToUrl(blob, fileName, target);
  if (isErr(result)) {
    toast(UPLOAD.failed, 'error', sendFailureMessage(result.error, host, t), openSettingsAction());
    return;
  }
  const count = nextInStreak(UPLOAD.done);
  toast(
    UPLOAD.done,
    'info',
    count === 1
      ? t('exportDestination.sent', { host })
      : t('exportDestination.sentMany', { host, count })
  );
}

function tryDownload(blob: Blob, fileName: string): boolean {
  try {
    triggerDownload(blob, fileName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hands a finished export to the user: downloads it, or writes it into the
 * chosen folder instead, and also POSTs it to the configured URL.
 *
 * Never rejects. Resolves once the local save is done (download, folder write,
 * or the download it falls back to); the upload carries on in the background
 * and reports through its own toast. With both destinations off this is
 * `triggerDownload`, run synchronously.
 */
export async function deliverExport(blob: Blob, fileName: string): Promise<void> {
  let triedDownload = false;
  try {
    const settings = useSettingsStore.getState().settings;
    const folder = settings.exportFolderName;
    if (folder === null) {
      triedDownload = true;
      triggerDownload(blob, fileName);
    }
    if (settings.exportUrlEnabled) void send(blob, fileName, settings).catch(() => undefined);
    if (folder !== null) await saveOrDownload(blob, fileName, folder);
  } catch {
    const downloaded = !triedDownload && tryDownload(blob, fileName);
    const message = downloaded ? 'exportDestination.fellBack' : 'exportDestination.failed';
    toast(FOLDER.failed, 'error', t(message, { file: fileName }));
  }
}
