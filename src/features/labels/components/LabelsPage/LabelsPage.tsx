import { useTranslation } from '@/i18n';
import { HeaderSupportLinks } from '@/shared/components/HeaderSupportLinks';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { useResponsive } from '@/shared/hooks';
import { useLabelsWorkspace } from '../../hooks/useLabelsWorkspace';
import { LabelListEditor } from '../LabelListEditor';
import { LabelPrinterSettings } from '../LabelPrinterSettings';
import { LabelsFooter } from '../LabelsFooter';

/** The label maker at /labels, for people who want labels without a layout. */
export function LabelsPage() {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const workspace = useLabelsWorkspace();

  return (
    <div className="flex h-dvh flex-col bg-surface text-content">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-stroke-subtle bg-surface-secondary px-3 md:px-4">
        <ToolSwitcher compact={isMobile} iconOnly={isMobile} />
        <div className="flex items-center gap-1">
          <HeaderSupportLinks compact={isMobile} />
        </div>
      </header>

      <div className="shrink-0 border-b border-stroke-subtle px-3 py-3 md:px-4">
        {/* h2: App renders the route-aware h1 for every surface. */}
        <h2 className="text-base font-semibold">{t('labels.title')}</h2>
        <p className="text-sm text-content-secondary">{t('labels.page.intro')}</p>
      </div>

      <main className="flex min-h-0 flex-1 max-md:flex-col max-md:overflow-y-auto">
        <aside className="w-72 shrink-0 border-r border-stroke-subtle p-4 md:overflow-y-auto max-md:w-full max-md:border-r-0 max-md:border-b">
          <LabelPrinterSettings />
        </aside>
        <section className="min-w-0 flex-1 p-4 md:overflow-y-auto">
          <div className="mx-auto max-w-3xl">
            <LabelListEditor plans={workspace.plans} measurer={workspace.measurer} />
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-stroke-subtle bg-surface-secondary px-3 py-3 md:px-4">
        <LabelsFooter workspace={workspace} />
      </footer>
    </div>
  );
}
