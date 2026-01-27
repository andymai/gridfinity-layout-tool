/**
 * Custom Bin Card - Draggable card for a saved design in the palette.
 *
 * Shows thumbnail, name, and dimensions.
 * Can be dragged onto the grid to create a linked bin.
 */

import { useCallback, useRef, useState } from 'react';
import type { CustomBinRef } from '@/features/bin-designer/store/customBinRegistry';
import { useTranslation } from '@/i18n';

interface CustomBinCardProps {
  design: CustomBinRef;
}

export function CustomBinCard({ design }: CustomBinCardProps) {
  const t = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Set drag data for the grid to consume
      e.dataTransfer.setData(
        'application/gridfinity-design',
        JSON.stringify({
          designId: design.id,
          width: design.width,
          depth: design.depth,
          height: design.height,
          name: design.name,
        })
      );
      e.dataTransfer.effectAllowed = 'copy';
      setIsDragging(true);
    },
    [design]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    // Navigate to edit design
    window.history.pushState(
      { designId: design.id },
      '',
      `/designer?id=${encodeURIComponent(design.id)}`
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [design.id]);

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={`
        relative group cursor-grab active:cursor-grabbing
        rounded-lg border border-stroke-subtle bg-surface
        hover:border-stroke hover:bg-surface-elevated
        transition-all overflow-hidden
        ${isDragging ? 'opacity-50 scale-95' : ''}
      `}
      title={`${design.name} - ${t('designLinking.palette.dragHint')}`}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-surface-elevated flex items-center justify-center overflow-hidden">
        {design.thumbnail ? (
          <img
            src={design.thumbnail}
            alt={design.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <svg
            className="w-8 h-8 text-content-disabled"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="text-xs font-medium text-content truncate">{design.name}</div>
        <div className="text-[10px] text-content-tertiary mt-0.5">
          {design.width}×{design.depth}×{design.height}
        </div>
      </div>

      {/* Drag hint overlay */}
      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
        <span className="text-xs font-medium text-primary bg-white/90 px-2 py-1 rounded">
          {t('designLinking.palette.dragHint')}
        </span>
      </div>
    </div>
  );
}
