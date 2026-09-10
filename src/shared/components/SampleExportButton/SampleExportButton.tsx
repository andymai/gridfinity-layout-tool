import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/design-system/Button';
import { ExportDialog } from '@/shared/components/ExportDialog';
import type { ExportDialogProps } from '@/shared/components/ExportDialog/ExportDialog';
import { useToastStore } from '@/core/store/toast';
import { FORMAT_EXTENSIONS } from '@/shared/generation/exportUtils';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';

interface SampleExportButtonProps {
  isExporting: boolean;
  canExport: boolean;
  downloadSample: (format: ExportFileFormat, baseName: string) => Promise<boolean>;
  defaultBaseName: string;
  label: string;
  leftIcon?: ReactNode;
  dialogTitle: string;
  dialogDescription: string;
  exportCompleteMessage: string;
  tips?: { readonly title: string; readonly items: readonly string[] };
  formatStates?: ExportDialogProps['formatStates'];
}

export function SampleExportButton({
  isExporting,
  canExport,
  downloadSample,
  defaultBaseName,
  label,
  leftIcon,
  dialogTitle,
  dialogDescription,
  exportCompleteMessage,
  tips,
  formatStates,
}: SampleExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [fileNameConfig, setFileNameConfig] = useState<ExportFileNameConfig>({
    style: 'descriptive',
    customName: '',
    format: 'stl',
  });

  const activeFormat: ExportFileFormat = fileNameConfig.format ?? 'stl';
  const displayExtension = FORMAT_EXTENSIONS[activeFormat];
  const baseName =
    fileNameConfig.style === 'custom' && fileNameConfig.customName.trim() !== ''
      ? fileNameConfig.customName.trim()
      : defaultBaseName;

  const handleDownload = useCallback(() => {
    void downloadSample(activeFormat, baseName).then((succeeded) => {
      if (!succeeded) return;
      useToastStore.getState().addToast(exportCompleteMessage, 'success', 3000);
      setOpen(false);
    });
  }, [downloadSample, activeFormat, baseName, exportCompleteMessage]);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        {...(leftIcon ? { leftIcon } : {})}
        onClick={() => setOpen(true)}
        disabled={!canExport}
      >
        {label}
      </Button>

      <ExportDialog
        open={open}
        onClose={() => setOpen(false)}
        activeFormat={activeFormat}
        fileNameConfig={fileNameConfig}
        onFileNameConfigChange={setFileNameConfig}
        fileName={`${baseName}${displayExtension}`}
        displayExtension={displayExtension}
        canExport={canExport}
        isExporting={isExporting}
        onDownload={handleDownload}
        sectionTitle={dialogTitle}
        sectionDescription={dialogDescription}
        {...(formatStates ? { formatStates } : {})}
        {...(tips
          ? {
              extras: (
                <div className="mb-4 rounded-lg border border-stroke-subtle bg-surface p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-tertiary">
                    {tips.title}
                  </h3>
                  <ul className="space-y-1 text-xs text-content-secondary">
                    {tips.items.map((tip) => (
                      <li key={tip} className="flex gap-2">
                        <span aria-hidden="true" className="text-content-tertiary">
                          •
                        </span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            }
          : {})}
      />
    </>
  );
}
