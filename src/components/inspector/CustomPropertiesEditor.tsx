import { useState } from 'react';
import { CONSTRAINTS, RESERVED_PROPERTY_KEYS } from '../../constants';

interface CustomPropertiesEditorProps {
  customProperties?: Record<string, string>;
  onChange: (properties: Record<string, string>) => void;
  /** Platform variant affects touch targets and sizing */
  variant: 'desktop' | 'mobile';
}

/**
 * Editor for custom key-value properties on bins.
 * Allows adding, editing, and removing custom properties.
 */
export function CustomPropertiesEditor({
  customProperties = {},
  onChange,
  variant,
}: CustomPropertiesEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMobile = variant === 'mobile';
  const inputHeight = isMobile ? 'h-12' : '';
  const labelSize = isMobile ? 'text-sm mb-2' : 'text-xs mb-1';

  const properties = Object.entries(customProperties);
  const hasProperties = properties.length > 0;
  const atMaxProperties = properties.length >= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT;

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

  const handleUpdate = (oldKey: string, newValue: string) => {
    onChange({
      ...customProperties,
      [oldKey]: newValue,
    });
    setEditingKey(null);
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
      if (isAdding) {
        handleCancelAdd();
      } else {
        setEditingKey(null);
      }
    }
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

      {/* Existing properties */}
      {hasProperties && (
        <div className="space-y-2 mb-3">
          {properties.map(([key, value]) => (
            <div
              key={key}
              className="bg-surface-elevated border border-stroke-subtle rounded p-2.5"
            >
              {editingKey === key ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-content-secondary flex-shrink-0">
                      {key}:
                    </span>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleUpdate(key, e.target.value.slice(0, CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH))}
                      onBlur={() => setEditingKey(null)}
                      onKeyDown={(e) => handleKeyDown(e, () => setEditingKey(null))}
                      className="input flex-1 text-sm py-1"
                      placeholder="Value"
                      aria-label={`Edit value for ${key}`}
                      autoFocus
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-content-secondary break-words">
                      {key}
                    </div>
                    <div className="text-sm text-content break-words mt-0.5">
                      {value || <span className="text-content-disabled italic">empty</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingKey(key)}
                      className="p-1 text-content-tertiary hover:text-content transition-colors"
                      title="Edit"
                      aria-label={`Edit ${key}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(key)}
                      className="p-1 text-content-tertiary hover:text-error transition-colors"
                      title="Delete"
                      aria-label={`Delete ${key}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
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
              setError(null); // Clear error on input
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
              setError(null); // Clear error on input
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
    </div>
  );
}
