import { useState, type RefObject } from 'react';
import { Popover } from '@/design-system';
import { useTranslation } from '@/i18n';

// Square sizes
const SQUARE_SIZES = [1, 2, 3, 4, 5, 6];

// Rectangle sizes (width x depth where width < depth)
const RECTANGLE_SIZES = [
  { w: 1, d: 2 },
  { w: 1, d: 3 },
  { w: 1, d: 4 },
  { w: 1, d: 5 },
  { w: 1, d: 6 },
  { w: 2, d: 3 },
  { w: 2, d: 4 },
  { w: 2, d: 5 },
  { w: 2, d: 6 },
  { w: 3, d: 4 },
  { w: 3, d: 5 },
  { w: 3, d: 6 },
  { w: 4, d: 5 },
  { w: 4, d: 6 },
  { w: 5, d: 6 },
];

interface SizeSelectorPopoverProps {
  anchorRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  paintSize: { width: number; depth: number } | null;
  onSelectSize: (w: number, d: number) => void;
  onShiftClickSize: (w: number, d: number) => void;
}

function SizeButton({
  w,
  d,
  isActive,
  onClick,
}: {
  w: number;
  d: number;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const t = useTranslation();
  const previewWidth = w * 4;
  const previewHeight = d * 4;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-end gap-1 h-[52px] p-1.5 rounded-lg border transition-colors ${
        isActive
          ? 'bg-accent/20 border-accent/40'
          : 'border-transparent hover:bg-surface-hover hover:border-stroke-subtle'
      }`}
      aria-label={t('layers.paintSizeAriaLabel', {
        action: isActive ? t('layers.deselect') : t('layers.select'),
        width: w,
        depth: d,
      })}
      title={t('layers.paintSizeTitle', { width: w, depth: d })}
    >
      <div
        className="rounded-[2px]"
        style={{
          width: previewWidth,
          height: previewHeight,
          backgroundColor: isActive ? 'var(--color-accent)' : 'var(--text-tertiary)',
        }}
      />
      <span
        className={`text-[9px] leading-none ${isActive ? 'text-accent font-medium' : 'text-content-tertiary'}`}
      >
        {w}×{d}
      </span>
    </button>
  );
}

export function SizeSelectorPopover({
  anchorRef,
  isOpen,
  onClose,
  paintSize,
  onSelectSize,
  onShiftClickSize,
}: SizeSelectorPopoverProps) {
  const t = useTranslation();
  const [rotated, setRotated] = useState(false);

  const isPaintActive = (w: number, d: number) => paintSize?.width === w && paintSize.depth === d;

  const getRectDims = (w: number, d: number) => (rotated ? { w: d, d: w } : { w, d });

  const handleSizeClick = (w: number, d: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      onShiftClickSize(w, d);
      // Keep popover open for stash operations
    } else {
      onSelectSize(w, d);
      onClose();
    }
  };

  return (
    <Popover anchorRef={anchorRef} isOpen={isOpen} onClose={onClose} className="w-[264px]">
      {/* Squares section */}
      <div className="px-3 pt-3">
        <div className="text-[11px] font-medium text-content-secondary uppercase tracking-wider mb-1.5">
          {t('layers.squares')}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {SQUARE_SIZES.map((size) => (
            <SizeButton
              key={`${size}×${size}`}
              w={size}
              d={size}
              isActive={isPaintActive(size, size)}
              onClick={(e) => handleSizeClick(size, size, e)}
            />
          ))}
        </div>
      </div>

      {/* Rectangles section */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mt-3 mb-1.5">
          <span className="text-[11px] font-medium text-content-secondary uppercase tracking-wider">
            {t('layers.rectangles')}
          </span>
          <button
            onClick={() => setRotated(!rotated)}
            className="text-[11px] text-content-tertiary hover:text-content flex items-center gap-1 transition-colors rounded px-1.5 py-0.5 hover:bg-surface-hover"
            title={rotated ? t('layers.showingTall') : t('layers.showingWide')}
            aria-label={rotated ? t('layers.switchToWide') : t('layers.switchToTall')}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {rotated ? t('layers.tall') : t('layers.wide')}
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {RECTANGLE_SIZES.map(({ w, d }) => {
            const dims = getRectDims(w, d);
            return (
              <SizeButton
                key={`${w}×${d}`}
                w={dims.w}
                d={dims.d}
                isActive={isPaintActive(dims.w, dims.d)}
                onClick={(e) => handleSizeClick(dims.w, dims.d, e)}
              />
            );
          })}
        </div>
      </div>

      {/* Help text footer */}
      <div className="px-3 py-2 border-t border-stroke-subtle bg-surface/50 rounded-b-xl">
        <p className="text-[10px] text-content-tertiary leading-relaxed">
          {t('layers.binPaletteInstruction')}{' '}
          <span className="text-content-disabled">{t('layers.binPaletteHint')}</span>
        </p>
      </div>
    </Popover>
  );
}
