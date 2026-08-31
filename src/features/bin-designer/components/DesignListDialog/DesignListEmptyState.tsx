import { useTranslation } from '@/i18n';
import { Button, PlusIcon } from '@/design-system';

interface DesignListEmptyStateProps {
  onNewDesign: () => void;
}

/** Shown when no designs are saved yet, inviting the user to start a new design. */
export function DesignListEmptyState({ onNewDesign }: DesignListEmptyStateProps) {
  const t = useTranslation();

  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
        <svg
          className="h-6 w-6 text-content-tertiary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-content-secondary">
        {t('binDesigner.noSavedDesignsYet')}
      </p>
      <p className="mt-1 text-xs text-content-disabled">
        {t('binDesigner.changesAreSavedAutomaticallyAsYouDe')}
      </p>
      <Button
        variant="primary"
        // Call with no args: wiring `onClick={onNewDesign}` passes the click
        // event as the first argument, which the parent reads as the item kind
        // (a `[object Object]` that has no descriptor, crashing new-design).
        onClick={() => onNewDesign()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
        leftIcon={<PlusIcon className="h-4 w-4" />}
      >
        {t('binDesigner.startANewDesign')}
      </Button>
    </div>
  );
}
