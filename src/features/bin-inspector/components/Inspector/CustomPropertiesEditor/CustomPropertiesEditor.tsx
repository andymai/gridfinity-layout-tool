import { useState } from 'react';
import { CONSTRAINTS, RESERVED_PROPERTY_KEYS } from '@/core/constants';
import { Button, IconButton, XIcon } from '@/design-system';
import { useTranslation } from '@/i18n';

interface CustomPropertiesEditorProps {
  customProperties?: Record<string, string>;
  onChange: (properties: Record<string, string>) => void;
  /** Platform variant affects touch targets and sizing */
  variant: 'desktop' | 'mobile';
  /** Property keys used by other bins in the layout (for quick add suggestions) */
  suggestedKeys?: string[];
}

/**
 * Editor for custom key-value properties on bins.
 * Allows adding, editing, and removing custom properties.
 */
export function CustomPropertiesEditor({
  customProperties = {},
  onChange,
  variant,
  suggestedKeys = [],
}: CustomPropertiesEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const t = useTranslation();

  const isMobile = variant === 'mobile';
  const inputHeight = isMobile ? 'h-12' : '';
  const labelSize = isMobile ? 'text-sm mb-2' : 'text-xs mb-1';

  // Sort properties alphabetically for consistent display across bins
  const properties = Object.entries(customProperties).sort(([a], [b]) => a.localeCompare(b));
  const hasProperties = properties.length > 0;
  const atMaxProperties = properties.length >= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT;

  // Keys that exist in other bins but not this one
  const availableSuggestions = suggestedKeys.filter((key) => !(key in customProperties));

  const handleAdd = () => {
    const trimmedKey = newKey.trim();
    const trimmedValue = newValue.trim();

    // Validate
    if (!trimmedKey) {
      setError(t('binDesigner.customProperty.error.nameRequired'));
      return;
    }

    if (!trimmedValue) {
      setError(t('binDesigner.customProperty.error.valueRequired'));
      return;
    }

    if (RESERVED_PROPERTY_KEYS.includes(trimmedKey as (typeof RESERVED_PROPERTY_KEYS)[number])) {
      setError(t('binDesigner.customProperty.error.reservedName', { name: trimmedKey }));
      return;
    }

    if (trimmedKey in customProperties) {
      setError(t('binDesigner.customProperty.error.nameExists'));
      return;
    }

    if (properties.length >= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT) {
      setError(
        t('binDesigner.customProperty.error.maxReached', {
          max: CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT,
        })
      );
      return;
    }

    onChange({
      ...customProperties,
      [trimmedKey]: trimmedValue,
    });

    setNewKey('');
    setNewValue('');
    setError(null);
    setIsAdding(false);
  };

  const handleUpdate = (key: string, newValue: string) => {
    // Trim value to remove leading/trailing whitespace
    const trimmedValue = newValue.trim();
    onChange({
      ...customProperties,
      [key]: trimmedValue,
    });
  };

  const handleDelete = (key: string) => {
    // Use object destructuring to avoid dynamic delete (ESLint rule)
    const updated = Object.fromEntries(Object.entries(customProperties).filter(([k]) => k !== key));
    onChange(updated);
  };

  const handleCancelAdd = () => {
    setNewKey('');
    setNewValue('');
    setError(null);
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelAdd();
    }
  };

  // Quick-add a suggested key with empty value (user fills in value)
  const handleQuickAdd = (key: string) => {
    if (atMaxProperties) return;
    setNewKey(key);
    setNewValue('');
    setIsAdding(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={`block ${labelSize} text-content-tertiary`}>
          {hasProperties
            ? t('rightPanel.customPropertiesCount', { count: properties.length })
            : t('inspector.customProperties')}
        </label>
        {!isAdding && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => setIsAdding(true)}
            disabled={atMaxProperties}
            className="text-xs text-accent hover:text-accent-hover px-0 py-0 hover:bg-transparent"
            aria-label={t('inspector.addCustomProperty')}
            title={
              atMaxProperties
                ? t('inspector.maxPropertiesReached', {
                    max: CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT,
                  })
                : t('inspector.addCustomProperty')
            }
          >
            {t('inspector.add')}
          </Button>
        )}
      </div>

      {/* Existing properties - always editable */}
      {hasProperties && (
        <div className="space-y-2 mb-3">
          {properties.map(([key, value]) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs text-content-secondary flex-shrink-0">{key}</label>
                <IconButton
                  variant="dangerGhost"
                  size="sm"
                  touchTarget={false}
                  type="button"
                  onClick={() => handleDelete(key)}
                  className="ml-auto text-content-tertiary"
                  title={t('inspector.customProps.deleteProperty')}
                  aria-label={`Delete ${key}`}
                >
                  <XIcon className="w-3.5 h-3.5" />
                </IconButton>
              </div>
              <input
                type="text"
                value={value}
                onChange={(e) =>
                  handleUpdate(
                    key,
                    e.target.value.slice(0, CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH)
                  )
                }
                maxLength={CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH}
                className={`input w-full ${inputHeight}`}
                placeholder={t('inspector.customProps.multiValuePlaceholder')}
                aria-label={`Value for ${key}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add new property form */}
      {isAdding && (
        <div className="bg-surface-elevated border border-stroke-subtle rounded p-2.5 space-y-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => {
              setNewKey(e.target.value.slice(0, CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH));
              setError(null);
            }}
            onKeyDown={(e) => handleKeyDown(e, handleAdd)}
            maxLength={CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH}
            className={`input w-full ${inputHeight} ${error ? 'border-error' : ''}`}
            placeholder={t('inspector.customProps.keyPlaceholder')}
            aria-label={t('inspector.newPropertyName')}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
            autoFocus
          />
          <input
            type="text"
            value={newValue}
            onChange={(e) => {
              setNewValue(e.target.value.slice(0, CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH));
              setError(null);
            }}
            onKeyDown={(e) => handleKeyDown(e, handleAdd)}
            maxLength={CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH}
            className={`input w-full ${inputHeight}`}
            placeholder={t('inspector.customProps.multiValuePlaceholder')}
            aria-label={t('inspector.newPropertyValue')}
          />
          {error && (
            <div className="text-xs text-error" role="alert" aria-live="assertive">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              type="button"
              onClick={handleAdd}
              disabled={!newKey.trim() || !newValue.trim()}
              className={`flex-1 ${isMobile ? 'h-10' : 'h-8'}`}
            >
              {t('common.add')}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={handleCancelAdd}
              className={`flex-1 ${isMobile ? 'h-10' : 'h-8'}`}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      {!hasProperties && !isAdding && (
        <div className="text-sm text-content-disabled italic">
          {t('inspector.noCustomProperties')}
        </div>
      )}

      {/* Quick add suggestions - show keys used by other bins */}
      {!isAdding && availableSuggestions.length > 0 && !atMaxProperties && (
        <div className="mt-2 pt-2 border-t border-stroke-subtle">
          <div className="text-xs text-content-tertiary mb-1.5">
            {t('inspector.quickAddFromOtherBins')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.slice(0, 6).map((key) => (
              <Button
                key={key}
                variant="secondary"
                type="button"
                onClick={() => handleQuickAdd(key)}
                className="text-xs px-2 py-1 text-content-secondary hover:text-content"
                title={t('inspector.addProperty', { key })}
              >
                {t('inspector.addPrefix', { key })}
              </Button>
            ))}
            {availableSuggestions.length > 6 && (
              <span className="text-xs text-content-disabled px-1 py-1">
                {t('inspector.moreCount', { count: availableSuggestions.length - 6 })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
