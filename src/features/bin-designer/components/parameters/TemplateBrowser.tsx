/**
 * Template browser for adding insert templates to the bin.
 *
 * Displays available templates with category filtering.
 * Clicking a template adds an insert at the next available position.
 */

import { useState, useMemo } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useShallow } from 'zustand/react/shallow';
import { ALL_TEMPLATES, AVAILABLE_CATEGORIES, searchTemplates } from '@/features/bin-designer/templates';
import type { InsertTemplate, TemplateCategory, Insert } from '@/features/bin-designer/types';

/** Category display labels */
const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  electronics: 'Electronics',
  hardware: 'Hardware',
  tools: 'Tools',
};

/** Generate a unique ID for new inserts */
function generateInsertId(): string {
  return `ins-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Find the next available position for a new insert.
 * Places inserts in a grid pattern, offsetting to avoid overlap.
 */
function getNextPosition(
  existingInserts: readonly Insert[],
  width: number,
  _depth: number
): { x: number; y: number } {
  if (existingInserts.length === 0) {
    return { x: 2, y: 2 }; // Small margin from edge
  }

  // Stack inserts with a small gap offset
  const gap = 2;
  const lastInsert = existingInserts[existingInserts.length - 1];
  let x = lastInsert.x + lastInsert.width + gap;
  let y = lastInsert.y;

  // Wrap to next row if exceeding a reasonable width (60mm inner area)
  if (x + width > 60) {
    x = 2;
    y = lastInsert.y + lastInsert.depth + gap;
  }

  return { x, y };
}

export function TemplateBrowser() {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { inserts, addInsert } = useDesignerStore(
    useShallow((s) => ({
      inserts: s.params.inserts,
      addInsert: s.addInsert,
    }))
  );

  const filteredTemplates = useMemo(() => {
    // Apply search first, then category filter
    const searched = searchQuery ? searchTemplates(searchQuery) : ALL_TEMPLATES;
    if (activeCategory === 'all') return searched;
    return searched.filter((t) => t.category === activeCategory);
  }, [searchQuery, activeCategory]);

  const handleAddTemplate = (template: InsertTemplate) => {
    const pos = getNextPosition(inserts, template.defaults.width, template.defaults.depth);
    const insert: Insert = {
      id: generateInsertId(),
      templateId: template.id,
      shape: template.defaults.shape,
      x: pos.x,
      y: pos.y,
      width: template.defaults.width,
      depth: template.defaults.depth,
      cutDepth: template.defaults.cutDepth,
      rotation: template.defaults.rotation,
      cornerRadius: template.defaults.cornerRadius,
      label: template.defaults.label,
    };
    addInsert(insert);
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-content-secondary">Templates</span>

      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-tertiary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search templates…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-stroke-subtle bg-surface py-1.5 pl-7 pr-2 text-xs text-content placeholder:text-content-tertiary focus:border-accent focus:outline-none"
          aria-label="Search templates"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1" role="tablist" aria-label="Template categories">
        <CategoryTab
          label="All"
          isActive={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
        />
        {AVAILABLE_CATEGORIES.map((cat) => (
          <CategoryTab
            key={cat}
            label={CATEGORY_LABELS[cat]}
            isActive={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
          />
        ))}
      </div>

      {/* Template grid */}
      <div
        className="grid grid-cols-2 gap-1.5"
        role="list"
        aria-label="Available templates"
      >
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onAdd={() => handleAddTemplate(template)}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <p className="py-3 text-center text-xs text-content-tertiary">
          {searchQuery
            ? `No templates matching "${searchQuery}"`
            : 'No templates in this category yet.'}
        </p>
      )}

      {/* Result count (shown when filtering) */}
      {(searchQuery || activeCategory !== 'all') && filteredTemplates.length > 0 && (
        <p className="text-center text-[10px] text-content-tertiary">
          {filteredTemplates.length} of {ALL_TEMPLATES.length} templates
        </p>
      )}
    </div>
  );
}

function CategoryTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
        isActive
          ? 'bg-accent-muted text-accent'
          : 'text-content-tertiary hover:bg-surface-hover hover:text-content-secondary'
      }`}
    >
      {label}
    </button>
  );
}

function TemplateCard({
  template,
  onAdd,
}: {
  template: InsertTemplate;
  onAdd: () => void;
}) {
  return (
    <button
      role="listitem"
      onClick={onAdd}
      className="flex flex-col items-start gap-0.5 rounded-md border border-stroke-subtle bg-surface-secondary p-2 text-left transition-colors hover:border-accent/50 hover:bg-surface-hover"
      title={template.description}
      aria-label={`Add ${template.name}`}
    >
      <span className="text-xs font-medium text-content">{template.name}</span>
      <span className="text-[10px] text-content-tertiary">
        {template.defaults.width}×{template.defaults.depth}×{template.defaults.cutDepth}mm
      </span>
    </button>
  );
}
