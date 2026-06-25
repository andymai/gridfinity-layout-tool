import { useDesignerStore } from '@/features/bin-designer/store';

/**
 * Whether the right inspector applies to the current design + mode. Viewport is
 * NOT considered here — the layout decides desktop column vs touch sheet; this
 * is the shared mode gate both forms use.
 *
 * Excluded: the cutout editor (it has its own InspectorDock), non-bin items
 * (tool racks are a follow-up), and solid style (which runs the cutout editor).
 */
export function useRightInspectorVisible(): boolean {
  return useDesignerStore(
    (s) =>
      !s.ui.cutoutEditorOpen &&
      s.itemKind === 'bin' &&
      (s.params.style === 'standard' || s.params.style === 'slotted')
  );
}
