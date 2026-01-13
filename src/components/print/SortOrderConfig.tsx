import { useCallback, useState } from 'react';
import type { BinListSortOrder, SortFieldConfig, BinSortField } from '../../store/settings';
import { SORT_FIELD_LABELS } from '../../store/settings';

interface SortOrderConfigProps {
  sortOrder: BinListSortOrder;
  onChange: (newOrder: BinListSortOrder) => void;
}

/**
 * Configurable sort order component with drag-to-reorder and toggle.
 * Users can enable/disable sort fields and drag to change priority.
 */
export function SortOrderConfig({ sortOrder, onChange }: SortOrderConfigProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Toggle a field's enabled state
  const toggleField = useCallback(
    (field: BinSortField) => {
      const newOrder = sortOrder.map((item) =>
        item.field === field ? { ...item, enabled: !item.enabled } : item
      );
      onChange(newOrder);
    },
    [sortOrder, onChange]
  );

  // Move a field up in the list
  const moveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const newOrder = [...sortOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      onChange(newOrder);
    },
    [sortOrder, onChange]
  );

  // Move a field down in the list
  const moveDown = useCallback(
    (index: number) => {
      if (index >= sortOrder.length - 1) return;
      const newOrder = [...sortOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      onChange(newOrder);
    },
    [sortOrder, onChange]
  );

  // Drag handlers
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newOrder = [...sortOrder];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(dragOverIndex, 0, removed);
      onChange(newOrder);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, sortOrder, onChange]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  // Get active sort fields for display
  const activeSortFields = sortOrder.filter((s) => s.enabled);

  return (
    <div className="sort-order-config">
      {/* Active sort summary */}
      {activeSortFields.length > 0 && (
        <div className="text-xs text-content-tertiary mb-2">
          Sorting by: {activeSortFields.map((s) => SORT_FIELD_LABELS[s.field]).join(' → ')}
        </div>
      )}

      {/* Reorderable list */}
      <div className="space-y-1">
        {sortOrder.map((config, index) => (
          <SortFieldItem
            key={config.field}
            config={config}
            index={index}
            isFirst={index === 0}
            isLast={index === sortOrder.length - 1}
            isDragging={draggedIndex === index}
            isDragOver={dragOverIndex === index}
            onToggle={() => toggleField(config.field)}
            onMoveUp={() => moveUp(index)}
            onMoveDown={() => moveDown(index)}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onDragLeave={handleDragLeave}
          />
        ))}
      </div>
    </div>
  );
}

interface SortFieldItemProps {
  config: SortFieldConfig;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
}

function SortFieldItem({
  config,
  index,
  isFirst,
  isLast,
  isDragging,
  isDragOver,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragLeave,
}: SortFieldItemProps) {
  return (
    <div
      className={`
        flex items-center gap-2 p-1.5 rounded-md -mx-1.5
        ${isDragging ? 'opacity-50' : ''}
        ${isDragOver ? 'bg-surface-hover ring-1 ring-accent' : 'hover:bg-surface-hover'}
        ${config.enabled ? '' : 'opacity-60'}
      `}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragLeave={onDragLeave}
    >
      {/* Drag handle */}
      <div
        className="cursor-grab text-content-tertiary hover:text-content-secondary"
        title="Drag to reorder"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      {/* Checkbox and label */}
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={onToggle}
          className="w-4 h-4"
        />
        <span className="text-sm text-content">
          {SORT_FIELD_LABELS[config.field]}
        </span>
      </label>

      {/* Priority indicator for enabled fields */}
      {config.enabled && (
        <span className="text-xs text-accent font-medium min-w-[1.5rem] text-center">
          {index + 1}
        </span>
      )}

      {/* Up/Down buttons for accessibility */}
      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-0.5 text-content-tertiary hover:text-content disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
          aria-label={`Move ${SORT_FIELD_LABELS[config.field]} up`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="p-0.5 text-content-tertiary hover:text-content disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
          aria-label={`Move ${SORT_FIELD_LABELS[config.field]} down`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
