import { Dialog } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useLabelsWorkspace } from '../../hooks/useLabelsWorkspace';
import { LabelListEditor } from '../LabelListEditor';
import { LabelPrinterSettings } from '../LabelPrinterSettings';
import { LabelsFooter } from '../LabelsFooter';

interface LabelsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function LabelsDialog({ open, onClose }: LabelsDialogProps) {
  const t = useTranslation();
  const workspace = useLabelsWorkspace();

  return (
    <Dialog.Root
      open={open}
      onClose={onClose}
      dismissable={!workspace.busy}
      size="3xl"
      height="fixed"
      fullScreen="mobile"
    >
      <Dialog.Header title={t('labels.title')} bordered closeAriaLabel={t('common.close')} />
      <Dialog.Split>
        <Dialog.Sidebar className="p-[var(--space-2xl)] max-md:w-full max-md:border-r-0 max-md:border-b">
          <LabelPrinterSettings />
        </Dialog.Sidebar>
        <Dialog.Pane>
          <LabelListEditor plans={workspace.plans} measurer={workspace.measurer} />
        </Dialog.Pane>
      </Dialog.Split>
      <Dialog.Footer bordered>
        <LabelsFooter workspace={workspace} />
      </Dialog.Footer>
    </Dialog.Root>
  );
}
