import type { PointerEvent } from 'react';
import { memo } from 'react';
import type {
  ResizeHandle as ResizeHandleType,
  HandleVariant,
  HandlePlacement,
} from '@/core/types';
import { ResizeHandle } from '../ResizeHandle';
import {
  getAllHandles,
  shouldUseExternalHandles,
} from '@/features/grid-editor/utils/handlePositioning';

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
function ResizeHandlesComponent({
  binWidth,
  binDepth,
  variant,
  onResizePointerDown,
}: ResizeHandlesProps) {
  // Determine placement mode based on bin dimensions
  const placement: HandlePlacement = shouldUseExternalHandles(binWidth, binDepth)
    ? 'external'
    : 'internal';

  return (
    <>
      {getAllHandles().map((handle) => (
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

// React.memo's default shallow per-prop comparison (Object.is) matches this component's needs.
export const ResizeHandles = memo(ResizeHandlesComponent);
