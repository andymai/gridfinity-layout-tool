/**
 * Schematic of the lip color grid: columns are the active corner quadrants,
 * rows are the active height bands (top band on top, matching the physical
 * stack). Each cell shows its color; hovering a cell highlights the matching
 * zone in the 3D preview. A stable reference while the preview rotates.
 */

import { useTranslation } from '@/i18n';
import {
  activeCornerColumns,
  LIP_BANDS,
  lipCellZone,
  type HoverableZone,
  type LipColorConfig,
} from '@/features/bin-designer/types/featureColors';

interface LipGridDiagramProps {
  lip: LipColorConfig;
  hovered: HoverableZone | null;
  onHover: (zone: HoverableZone | null) => void;
}

export function LipGridDiagram({ lip, hovered, onHover }: LipGridDiagramProps) {
  const t = useTranslation();
  const columns = activeCornerColumns(lip.corners);
  // Top band first so the diagram reads top-of-lip → bottom-of-lip.
  const rows = LIP_BANDS.slice(0, lip.bands).reverse();

  return (
    <div
      role="img"
      aria-label={t('binDesigner.colors.lip.gridDiagramAria')}
      className="grid shrink-0 gap-px rounded-md border border-stroke-subtle/60 bg-stroke-subtle/60 overflow-hidden shadow-inner"
      style={{
        gridTemplateColumns: `repeat(${columns.length}, 0.75rem)`,
        gridTemplateRows: `repeat(${rows.length}, 0.75rem)`,
      }}
    >
      {rows.map((band) =>
        columns.map((corner) => {
          const zone = lipCellZone(corner, band);
          const isHovered = hovered === zone || hovered === 'lip';
          return (
            <div
              key={zone}
              data-zone={zone}
              aria-hidden="true"
              onPointerEnter={() => onHover(zone)}
              onPointerLeave={() => onHover(null)}
              className={`transition-[box-shadow] ${isHovered ? 'ring-1 ring-inset ring-accent' : ''}`}
              style={{ backgroundColor: lip.cells[zone] }}
            />
          );
        })
      )}
    </div>
  );
}
