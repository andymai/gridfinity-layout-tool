import { useEffect, useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isErr } from '@/core/result';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { AlertTriangleIcon, Button, CheckIcon, Field, Input, Switch } from '@/design-system';
import { useTranslation } from '@/i18n';
import {
  allowExportFolder,
  canPickFolder,
  forgetExportFolder,
  getFolderAccess,
  pickExportFolder,
} from '@/shared/exportDestination/exportFolder';
import type { FolderAccess } from '@/shared/exportDestination/exportFolder';
import {
  checkExportUrl,
  isMixedContent,
  isValidHeaderName,
  isValidHeaderValue,
  readUrlTarget,
  sendFailureMessage,
  sendToUrl,
} from '@/shared/exportDestination/sendToUrl';
import { SettingSection } from '../../components/SettingSection/SettingSection';
import { FolderArrowIcon } from '../../tabIcons';

const EXAMPLE_URL = 'https://nas.local/upload';
const EXAMPLE_HEADER = 'X-API-Key';
const TEST_FILE_NAME = 'gridfinity-test.txt';
const URL_KEYS = [
  'exportUrlEnabled',
  'exportUrl',
  'exportUrlHeaderName',
  'exportUrlHeaderValue',
] as const;

function OptionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="min-w-0">
      <span className="text-sm text-content">{title}</span>
      <p className="mt-0.5 text-xs text-content-disabled">{hint}</p>
    </div>
  );
}

function FolderOption() {
  const t = useTranslation();
  const folderName = useSettingsStore((state) => state.settings.exportFolderName);
  const [access, setAccess] = useState<FolderAccess | null>(null);
  const [storeFailed, setStoreFailed] = useState(false);
  const supported = canPickFolder();

  useEffect(() => {
    if (!supported || folderName === null) return;
    let live = true;
    void getFolderAccess().then((next) => {
      if (!live) return;
      // The handle is gone (site data cleared), so the stored name points nowhere.
      if (next === 'missing') void forgetExportFolder();
      else setAccess(next);
    });
    return () => {
      live = false;
    };
  }, [supported, folderName]);

  const title = t('exportDestination.folder.title');
  if (!supported) {
    return <OptionHeading title={title} hint={t('exportDestination.folder.unsupported')} />;
  }

  // A new folder can carry the old one's name, which would not re-run the effect.
  const choose = () =>
    void pickExportFolder().then(async (picked) => {
      setStoreFailed(isErr(picked));
      if (!isErr(picked) && picked.value !== null) setAccess(await getFolderAccess());
    });
  const hint = t('exportDestination.folder.hint');
  const storeNote = storeFailed && (
    <p role="alert" className="text-xs text-warning">
      {t('exportDestination.folder.storeFailed')}
    </p>
  );
  if (folderName === null) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <OptionHeading title={title} hint={hint} />
          <Button size="sm" className="flex-shrink-0" onClick={choose}>
            {t('exportDestination.folder.choose')}
          </Button>
        </div>
        {storeNote}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <OptionHeading title={title} hint={hint} />
      <div aria-live="polite" className="space-y-2">
        <div className="flex items-center justify-between gap-2 rounded-md border border-stroke-subtle bg-surface-secondary px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-content">
            <FolderArrowIcon className="h-4 w-4 flex-shrink-0 text-content-tertiary" />
            <span className="truncate">{folderName}</span>
          </span>
          <span className="flex flex-shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={choose}>
              {t('exportDestination.folder.change')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void forgetExportFolder()}>
              {t('exportDestination.folder.forget')}
            </Button>
          </span>
        </div>
        {access === 'prompt' && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-warning">{t('exportDestination.folder.needsPermission')}</p>
            <Button
              variant="primary"
              size="sm"
              className="flex-shrink-0"
              onClick={() =>
                void allowExportFolder().then((granted) => {
                  if (granted) setAccess('granted');
                })
              }
            >
              {t('exportDestination.folder.allowAgain')}
            </Button>
          </div>
        )}
        {access === 'denied' && (
          <p className="text-xs text-warning">{t('exportDestination.folder.denied')}</p>
        )}
        {storeNote}
      </div>
    </div>
  );
}

interface TestResult {
  ok: boolean;
  message: string;
}

function UrlOption() {
  const t = useTranslation();
  const ids = useId();
  const settings = useSettingsStore(
    useShallow((state) => ({
      exportUrlEnabled: state.settings.exportUrlEnabled,
      exportUrl: state.settings.exportUrl,
      exportUrlHeaderName: state.settings.exportUrlHeaderName,
      exportUrlHeaderValue: state.settings.exportUrlHeaderValue,
      updateSetting: state.updateSetting,
    }))
  );
  const { exportUrl, exportUrlHeaderName, exportUrlHeaderValue, updateSetting } = settings;
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const testRun = useRef(0);

  const title = t('exportDestination.url.title');
  const hint = t('exportDestination.url.hint');
  const switchControl = (
    <Switch
      checked={settings.exportUrlEnabled}
      onChange={(checked) => updateSetting('exportUrlEnabled', checked)}
      aria-label={title}
    />
  );
  if (!settings.exportUrlEnabled) {
    return (
      <div className="flex items-center justify-between gap-3">
        <OptionHeading title={title} hint={hint} />
        {switchControl}
      </div>
    );
  }

  const target = readUrlTarget(settings);
  const trimmedUrl = exportUrl.trim();
  const urlProblem = trimmedUrl === '' ? null : checkExportUrl(trimmedUrl);
  let urlNote: string | null = null;
  if (urlProblem === 'invalid') urlNote = t('exportDestination.url.invalid');
  else if (urlProblem === 'scheme') urlNote = t('exportDestination.url.badScheme');
  else if (trimmedUrl !== '' && isMixedContent(new URL(trimmedUrl))) {
    urlNote = t('exportDestination.url.mixed');
  }
  const nameOk = isValidHeaderName(exportUrlHeaderName);
  const valueOk = isValidHeaderValue(exportUrlHeaderValue);
  let headerNote = t('exportDestination.url.headerHint');
  if (!nameOk) headerNote = t('exportDestination.url.badHeader');
  else if (!valueOk) headerNote = t('exportDestination.url.badHeaderValue');

  // Bumped by every edit, so a test that was already in flight does not
  // report on settings it never sent.
  const edit = (
    key: 'exportUrl' | 'exportUrlHeaderName' | 'exportUrlHeaderValue',
    value: string
  ) => {
    testRun.current += 1;
    updateSetting(key, value);
    setSending(false);
    setResult(null);
  };

  const sendTest = async () => {
    if (!target) return;
    const run = ++testRun.current;
    setSending(true);
    setResult(null);
    const host = target.url.host;
    const outcome = await sendToUrl(
      new Blob(['Gridfinity Layout Tool test file\n'], { type: 'text/plain' }),
      TEST_FILE_NAME,
      target
    );
    if (run !== testRun.current) return;
    setSending(false);
    setResult(
      isErr(outcome)
        ? { ok: false, message: sendFailureMessage(outcome.error, host, t) }
        : { ok: true, message: t('exportDestination.url.testSent', { host }) }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <OptionHeading title={title} hint={hint} />
        {switchControl}
      </div>

      <Field
        label={t('exportDestination.url.address')}
        htmlFor={`${ids}-url`}
        hint={
          urlNote && (
            <span id={`${ids}-url-note`} className="text-warning">
              {urlNote}
            </span>
          )
        }
      >
        <Input
          id={`${ids}-url`}
          type="url"
          inputMode="url"
          size="sm"
          fullWidth
          autoComplete="off"
          spellCheck={false}
          placeholder={EXAMPLE_URL}
          value={exportUrl}
          aria-invalid={urlProblem !== null || undefined}
          aria-describedby={urlNote ? `${ids}-url-note` : undefined}
          onChange={(e) => edit('exportUrl', e.target.value)}
        />
      </Field>

      <div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('exportDestination.url.headerName')} htmlFor={`${ids}-name`}>
            <Input
              id={`${ids}-name`}
              size="sm"
              fullWidth
              autoComplete="off"
              spellCheck={false}
              placeholder={EXAMPLE_HEADER}
              value={exportUrlHeaderName}
              aria-invalid={!nameOk || undefined}
              aria-describedby={`${ids}-header-note`}
              onChange={(e) => edit('exportUrlHeaderName', e.target.value)}
            />
          </Field>
          <Field label={t('exportDestination.url.headerValue')} htmlFor={`${ids}-value`}>
            <Input
              id={`${ids}-value`}
              type="password"
              size="sm"
              fullWidth
              autoComplete="off"
              value={exportUrlHeaderValue}
              aria-invalid={!valueOk || undefined}
              aria-describedby={`${ids}-header-note`}
              onChange={(e) => edit('exportUrlHeaderValue', e.target.value)}
            />
          </Field>
        </div>
        <p
          id={`${ids}-header-note`}
          className={`mt-1 text-xs ${nameOk && valueOk ? 'text-content-tertiary' : 'text-warning'}`}
        >
          {headerNote}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          size="sm"
          className="flex-shrink-0"
          loading={sending}
          disabled={!target}
          onClick={() => void sendTest()}
        >
          {t('exportDestination.url.test')}
        </Button>
        <p role="status" className="min-w-0 flex-1 text-xs">
          {result && (
            <span
              className={`flex items-start gap-1.5 ${result.ok ? 'text-success' : 'text-warning'}`}
            >
              {result.ok ? (
                <CheckIcon size="sm" className="mt-px flex-shrink-0" />
              ) : (
                <AlertTriangleIcon size="sm" className="mt-px flex-shrink-0" />
              )}
              <span>{result.message}</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export function ExportsTab() {
  const t = useTranslation();
  const title = t('settings.exportDestination');

  // No undo: the folder's permission goes with its handle and cannot come back.
  const reset = () => {
    useSettingsStore.getState().resetSettingKeys([...URL_KEYS]);
    void forgetExportFolder();
    useToastStore.getState().addToast(t('settings.section.resetDone', { section: title }), 'info');
  };

  return (
    <div className="space-y-8">
      <SettingSection
        id="export-destination"
        title={title}
        hint={t('exportDestination.hint')}
        onReset={reset}
      >
        <div className="space-y-5">
          <FolderOption />
          <div className="border-t border-stroke-subtle pt-5">
            <UrlOption />
          </div>
        </div>
      </SettingSection>
    </div>
  );
}
