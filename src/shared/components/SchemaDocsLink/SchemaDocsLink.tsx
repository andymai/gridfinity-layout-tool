import type { JSX } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/design-system/cn';

/** Public reference page for the layout and bin design JSON formats. */
export const SCHEMA_DOCS_URL = '/schema';

interface SchemaDocsLinkProps {
  readonly className?: string;
}

/**
 * Link to the JSON format reference, shown wherever a user meets a raw file:
 * both import views and both export dialogs.
 *
 * One component rather than four inline anchors, so the four sites cannot drift
 * apart in wording, target, or i18n key the way the version and attribution
 * links did.
 */
export function SchemaDocsLink({ className }: SchemaDocsLinkProps): JSX.Element {
  const t = useTranslation();
  return (
    <a
      href={SCHEMA_DOCS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('text-xs text-muted underline hover:text-content', className)}
    >
      {t('common.schemaDocsLink')}
    </a>
  );
}
