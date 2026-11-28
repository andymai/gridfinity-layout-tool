import { useTranslation } from '@/i18n';
import { SubHeader } from '@/shared/components/PanelText';
import { GridAlignmentControls } from '@/shared/components/GridAlignmentControls';
import type { ShapeEditorSlot } from '../../types/shapeEditor';
import { useBaseplatePanelDerived } from './panelState';

interface ShapeControlsProps {
  shapeEditor?: ShapeEditorSlot;
}

/** The Dimensions rows for the plate's shape: the shape editor, then the grid position inside it. */
export function ShapeControls({ shapeEditor: ShapeEditor }: ShapeControlsProps = {}) {
  const t = useTranslation();
  const { synced, outlineActive } = useBaseplatePanelDerived();

  return (
    <>
      {/* Out of sync the plate is a rectangle of its own size, so an edit to
          the drawer would change the layout and leave the plate as it was. */}
      {ShapeEditor !== undefined && (
        <ShapeEditor disabledReason={synced ? undefined : t('baseplate.editShapeNeedsSync')} />
      )}

      {/* Where the lattice sits inside the shape. Padding cannot express this:
          on a synced shaped plate the outer size comes from the drawer, so the
          slack between shape and cells is the only thing left to distribute,
          and moving the grid is what distributes it. Gated on the outline
          rather than on slack existing — a shape that exactly fills its extent
          has none yet, and gating it away there would make the first nudge
          unreachable. */}
      {outlineActive && (
        <div className="space-y-2 border-t border-stroke-subtle pt-3">
          <SubHeader info={t('baseplate.gridPositionDetail')}>
            {t('baseplate.gridPosition')}
          </SubHeader>
          <GridAlignmentControls />
        </div>
      )}
    </>
  );
}
