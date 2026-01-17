import type { PointerEvent } from 'react';
import { memo } from 'react';
import type { ResizeHandle as ResizeHandleType, HandleVariant, HandlePlacement } from '../../../../core/types';
import { ResizeHandle } from './ResizeHandle';
import { getAllHandles, shouldUseExternalHandles } from '../../../../utils/handlePositioning';

interface ResizeHandlesProps {
  binWidth: number;
  binDepth: number;
  variant: HandleVariant;
  onResizePointerDown: (e: PointerEvent<HTMLDivElement>, handle: ResizeHandleType) => void;
}

/**
 * Container for all resize handles (8 total: 4 edges + 4 corners).
 * Automatically determines internal vs external placement based on bin dimensions.
 */
function ResizeHandlesComponent({ binWidth, binDepth, variant, onResizePointerDown }: ResizeHandlesProps) {
  // Determine placement mode based on bin dimensions
  const placement: HandlePlacement = shouldUseExternalHandles(binWidth, binDepth)
    ? 'external'
    : 'internal';

  const handles = getAllHandles();

  return (
    <>
      {handles.map((handle) => (
        <ResizeHandle
          key={handle}
          handle={handle}
          placement={placement}
          variant={variant}
          onPointerDown={onResizePointerDown}
        />
      ))}
    </>
  );
}

/**
 * Custom comparison for memo optimization.
 */
function propsAreEqual(prev: ResizeHandlesProps, next: ResizeHandlesProps): boolean {
  return (
    prev.binWidth === next.binWidth &&
    prev.binDepth === next.binDepth &&
    prev.variant === next.variant &&
    prev.onResizePointerDown === next.onResizePointerDown
  );
}

export const ResizeHandles = memo(ResizeHandlesComponent, propsAreEqual);
