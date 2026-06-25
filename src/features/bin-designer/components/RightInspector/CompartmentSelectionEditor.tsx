/**
 * Writes label text through the same `setCompartmentText` action the left editor
 * uses, so the two stay in sync (on desktop the left inline field is suppressed
 * to avoid duplication).
 */

import { useShallow } from 'zustand/react/shallow';
import { Input } from '@/design-system/Input/Input';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import {
  getCompartmentBounds,
  getCompartmentReadingOrder,
} from '@/features/bin-designer/utils/compartments';

export function CompartmentSelectionEditor({ id }: { readonly id: number }) {
  const t = useTranslation();
  const { compartments, setCompartmentText } = useDesignerStore(
    useShallow((s) => ({
      compartments: s.params.compartments,
      setCompartmentText: s.setCompartmentText,
    }))
  );

  const readingIndex = getCompartmentReadingOrder(compartments).indexOf(id);
  const displayNumber = readingIndex >= 0 ? readingIndex + 1 : id + 1;

  const bounds = getCompartmentBounds(compartments, id);
  const span = bounds
    ? { w: bounds.maxCol - bounds.minCol + 1, h: bounds.maxRow - bounds.minRow + 1 }
    : null;

  const text = compartments.compartmentTexts?.[id] ?? '';

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2 text-xs">
        <span className="font-medium text-content-secondary">
          {t('binDesigner.inspector.compartment.title', { n: displayNumber })}
        </span>
        {span && (
          <span className="text-content-tertiary tabular-nums">
            {t('binDesigner.inspector.compartment.span', { w: span.w, h: span.h })}
          </span>
        )}
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-content-tertiary">
          {t('binDesigner.inspector.compartment.label')}
        </span>
        <Input
          size="sm"
          value={text}
          onChange={(e) => setCompartmentText(id, e.target.value)}
          placeholder={t('binDesigner.inspector.compartment.labelPlaceholder')}
        />
      </label>
    </div>
  );
}
