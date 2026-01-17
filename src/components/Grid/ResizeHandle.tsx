import type { PointerEvent } from 'react';
import { memo } from 'react';
import type { ResizeHandle as ResizeHandleType, HandleVariant, HandlePlacement } from '../../core/types';
import { getHandlePosition, getHandleVisual, isCornerHandle } from '../../utils/handlePositioning';

interface ResizeHandleProps {
  handle: ResizeHandleType;
  placement: HandlePlacement;
  variant: HandleVariant;
  onPointerDown: (e: PointerEvent<HTMLDivElement>, handle: ResizeHandleType) => void;
}

/**
 * Individual resize handle component.
 * Renders touch target and visual indicator based on configuration.
 */
function ResizeHandleComponent({ handle, placement, variant, onPointerDown }: ResizeHandleProps) {
  const position = getHandlePosition(handle, placement);
  const visual = getHandleVisual(handle);

  // Variant styling
  const isPrimary = variant === 'primary';

  // Accessibility labels (only for primary variant)
  const ariaLabel = isPrimary ? getAriaLabel(handle) : undefined;
  const role = isPrimary ? 'slider' : undefined;
  const ariaOrientation = isPrimary ? getAriaOrientation(handle) : undefined;

  return (
    <div
      className="absolute flex items-center justify-center group"
      style={{
        left: position.left,
        right: position.right,
        top: position.top,
        bottom: position.bottom,
        width: position.width,
        height: position.height,
        minWidth: position.minWidth,
        minHeight: position.minHeight,
        transform: position.transform,
        cursor: position.cursor,
      }}
      onPointerDown={(e) => onPointerDown(e, handle)}
      role={role}
      aria-label={ariaLabel}
      aria-orientation={ariaOrientation}
    >
      <div
        className="resize-handle-indicator"
        style={{
          width: visual.width,
          height: visual.height,
          minWidth: visual.minWidth,
          minHeight: visual.minHeight,
          background: 'var(--selection-ring)',
          borderRadius: 'var(--radius-sm)',
          // Ghost variant: no shadow, reduced opacity
          ...(isPrimary
            ? {
                boxShadow: isCornerHandle(handle)
                  ? 'var(--shadow-md)'
                  : 'var(--shadow-sm)',
              }
            : {
                opacity: 0.5,
              }),
        }}
      />
    </div>
  );
}

/**
 * Get aria-label for accessibility.
 */
function getAriaLabel(handle: ResizeHandleType): string {
  const labels: Record<ResizeHandleType, string> = {
    w: 'Resize left edge',
    e: 'Resize right edge',
    n: 'Resize top edge',
    s: 'Resize bottom edge',
    nw: 'Resize top-left corner',
    ne: 'Resize top-right corner',
    sw: 'Resize bottom-left corner',
    se: 'Resize bottom-right corner',
  };
  return labels[handle];
}

/**
 * Get aria-orientation for edge handles.
 */
function getAriaOrientation(handle: ResizeHandleType): 'horizontal' | 'vertical' | undefined {
  if (handle === 'w' || handle === 'e') return 'horizontal';
  if (handle === 'n' || handle === 's') return 'vertical';
  return undefined;
}

/**
 * Custom comparison for memo optimization.
 * Only re-render if props change.
 */
function propsAreEqual(prev: ResizeHandleProps, next: ResizeHandleProps): boolean {
  return (
    prev.handle === next.handle &&
    prev.placement === next.placement &&
    prev.variant === next.variant &&
    prev.onPointerDown === next.onPointerDown
  );
}

export const ResizeHandle = memo(ResizeHandleComponent, propsAreEqual);
