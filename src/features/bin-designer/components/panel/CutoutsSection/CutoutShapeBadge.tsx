/**
 * Identity pill shown atop a selected cutout's property panel — an icon + the
 * shape's name (with side count for polygons), so it's obvious what's selected
 * (a slot reads as a slot, not "a rounded rectangle").
 */

import type { ReactNode } from 'react';
import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import { DEFAULT_POLYGON_SIDES } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';

function shapeName(shape: CutoutShape, t: ReturnType<typeof useTranslation>): string {
  switch (shape) {
    case 'rectangle':
      return t('binDesigner.cutouts.addRectangle');
    case 'circle':
      return t('binDesigner.cutouts.addCircle');
    case 'polygon':
      return t('binDesigner.cutouts.addPolygon');
    case 'slot':
      return t('binDesigner.cutouts.addSlot');
    case 'knifeSlot':
      return t('binDesigner.cutouts.addKnifeSlot');
    case 'mesh':
      return t('binDesigner.cutouts.shapeName.mesh');
    case 'text':
      return t('binDesigner.cutouts.addText');
    case 'path':
    default:
      return t('binDesigner.cutouts.shapeName.path');
  }
}

function ShapeGlyph({ shape }: { readonly shape: CutoutShape }): ReactNode {
  const common = {
    className: 'h-3.5 w-3.5 text-accent',
    viewBox: '0 0 14 14',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.4',
    'aria-hidden': true,
  } as const;
  switch (shape) {
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" />
        </svg>
      );
    case 'polygon':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3.5 1.5h7L13 7l-2.5 5.5h-7L1 7z" />
        </svg>
      );
    case 'slot':
      return (
        <svg {...common}>
          <rect x="1" y="4" width="12" height="6" rx="3" />
        </svg>
      );
    case 'knifeSlot':
      return (
        <svg {...common} strokeLinejoin="round" strokeLinecap="round">
          {/* Chef knife: curved-edge blade pointing left, stub handle right */}
          <path d="M9.5 4.8H1.3c.2 2.2 2 3.9 4.2 3.9h4z" />
          <path d="M9.5 6.8H13" strokeWidth="1.9" />
        </svg>
      );
    case 'mesh':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M7 1.5L12 4v6l-5 2.5L2 10V4z" />
          <path d="M2 4l5 2.5L12 4" />
          <path d="M7 6.5V13" />
        </svg>
      );
    case 'path':
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 C5 2, 13 12, 2 12" />
        </svg>
      );
    case 'text':
      return (
        <svg {...common} strokeLinecap="round">
          <path d="M2.5 3.5v-1h9v1" />
          <path d="M7 2.5v9" />
          <path d="M5 11.5h4" />
        </svg>
      );
    case 'rectangle':
    default:
      return (
        <svg {...common}>
          <rect x="1" y="2" width="12" height="10" rx="1" />
        </svg>
      );
  }
}

export function CutoutShapeBadge({ cutout }: { readonly cutout: Cutout }) {
  const t = useTranslation();
  const name = shapeName(cutout.shape, t);
  const sides = cutout.sides ?? DEFAULT_POLYGON_SIDES;
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-content-secondary">
      <ShapeGlyph shape={cutout.shape} />
      <span>
        {name}
        {cutout.shape === 'polygon' && (
          <span className="ml-1 font-normal text-content-tertiary tabular-nums">
            {`· ${sides}`}
          </span>
        )}
      </span>
    </div>
  );
}
