import { useState } from 'react';
import { CONSTRAINTS, RESERVED_PROPERTY_KEYS } from '../../../../core/constants';

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

  const isMobile = variant === 'mobile';
  const inputHeight = isMobile ? 'h-12' : '';
  const labelSize = isMobile ? 'text-sm mb-2' : 'text-xs mb-1';

  // Sort properties alphabetically for consistent display across bins
  const properties = Object.entries(customProperties).sort(([a], [b]) => a.localeCompare(b));
  const hasProperties = properties.length > 0;
  const atMaxProperties = properties.length >= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT;

  // Keys that exist in other bins but not this one
  const availableSuggestions = suggestedKeys.filter(
    (key) => !(key in customProperties)
  );

  const handleAdd = () => {
    const trimmedKey = newKey.trim();
    const trimmedValue = newValue.trim();

    // Validate
    if (!trimmedKey) {
      setError('Property name is required');
      return;
    }

    if (!trimmedValue) {
      setError('Property value is required');
      return;
    }

    if (RESERVED_PROPERTY_KEYS.includes(trimmedKey as typeof RESERVED_PROPERTY_KEYS[number])) {
      setError(`"${trimmedKey}" is a reserved field name`);
      return;
    }

    if (trimmedKey in customProperties) {
      setError('Property name already exists');
      return;
    }

    if (properties.length >= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT) {
      setError(`Maximum ${CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT} properties allowed`);
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
    const updated = Object.fromEntries(
      Object.entries(customProperties).filter(([k]) => k !== key)
    );
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
          Custom Properties {hasProperties && <span className="text-content-disabled">({properties.length})</span>}
        </label>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            disabled={atMaxProperties}
            className="text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Add custom property"
            title={atMaxProperties ? `Maximum ${CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT} properties reached` : 'Add custom property'}
          >
            + Add
          </button>
        )}
      </div>

      {/* Existing properties - always editable */}
      {hasProperties && (
        <div className="space-y-2 mb-3">
          {properties.map(([key, value]) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs text-content-secondary flex-shrink-0">
                  {key}
                </label>
                <button
                  type="button"
                  onClick={() => handleDelete(key)}
                  className="ml-auto p-1 text-content-tertiary hover:text-error transition-colors"
                  title="Delete property"
                  aria-label={`Delete ${key}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                value={value}
                onChange={(e) => handleUpdate(key, e.target.value.slice(0, CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH))}
                className={`input w-full ${inputHeight}`}
                placeholder="Value"
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
            className={`input w-full ${inputHeight} ${error ? 'border-error' : ''}`}
            placeholder="Property name (e.g., SKU, Quantity)"
            aria-label="New property name"
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
            className={`input w-full ${inputHeight}`}
            placeholder="Value"
            aria-label="New property value"
          />
          {error && (
            <div className="text-xs text-error">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newKey.trim() || !newValue.trim()}
              className={`btn btn-primary flex-1 ${isMobile ? 'h-10' : 'h-8'}`}
            >
              Add
            </button>
            <button
              type="button"
              onClick={handleCancelAdd}
              className={`btn btn-ghost flex-1 ${isMobile ? 'h-10' : 'h-8'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!hasProperties && !isAdding && (
        <div className="text-sm text-content-disabled italic">
          No custom properties
        </div>
      )}

      {/* Quick add suggestions - show keys used by other bins */}
      {!isAdding && availableSuggestions.length > 0 && !atMaxProperties && (
        <div className="mt-2 pt-2 border-t border-stroke-subtle">
          <div className="text-xs text-content-tertiary mb-1.5">
            Quick add from other bins:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.slice(0, 6).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleQuickAdd(key)}
                className="text-xs px-2 py-1 rounded bg-surface-secondary hover:bg-surface-elevated text-content-secondary hover:text-content transition-colors border border-stroke-subtle"
                title={`Add "${key}" property`}
              >
                + {key}
              </button>
            ))}
            {availableSuggestions.length > 6 && (
              <span className="text-xs text-content-disabled px-1 py-1">
                +{availableSuggestions.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
