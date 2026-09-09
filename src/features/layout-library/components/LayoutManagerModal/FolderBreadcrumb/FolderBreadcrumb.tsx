import type { LayoutFolder } from '@/core/types';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';

interface FolderBreadcrumbProps {
  /** Root to leaf, empty at the root. */
  readonly path: readonly LayoutFolder[];
  readonly onNavigate: (folderId: string | null) => void;
}

/**
 * Where the list is in the folder tree, each step a button back up to it. The
 * last step is the current folder and is not a link.
 */
export function FolderBreadcrumb({ path, onNavigate }: FolderBreadcrumbProps) {
  const t = useTranslation();
  const steps: Array<{ id: string | null; name: string }> = [
    { id: null, name: t('layouts.folders.all') },
    ...path.map((f) => ({ id: f.id, name: f.name })),
  ];
  return (
    <nav aria-label={t('layouts.folders.breadcrumb')} className="flex min-w-0 items-center gap-1">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={step.id ?? 'root'} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <span aria-hidden className="text-content-disabled">
                  /
                </span>
              )}
              {last ? (
                <span aria-current="location" className="truncate font-medium text-content">
                  {step.name}
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate(step.id)}
                  className="h-7 truncate px-1.5 text-content-secondary hover:text-content"
                >
                  {step.name}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
