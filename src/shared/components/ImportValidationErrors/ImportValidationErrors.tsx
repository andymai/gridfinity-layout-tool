import { useTranslation } from '@/i18n';
import { SchemaDocsLink } from '@/shared/components/SchemaDocsLink';

export function ImportValidationErrors({ errors }: { errors: readonly string[] }) {
  const t = useTranslation();
  if (errors.length === 0) return null;
  return (
    <div className="bg-danger-muted border border-danger rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-sm font-medium text-danger mb-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {t('layouts.validationErrors')}
      </div>
      <ul className="text-sm text-danger/80 space-y-1 ml-6">
        {errors.map((error, index) => (
          <li key={index}>• {error}</li>
        ))}
      </ul>
      <SchemaDocsLink className="mt-2 ml-6 inline-block text-danger/80 hover:text-danger" />
    </div>
  );
}
