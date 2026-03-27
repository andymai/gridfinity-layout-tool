import type { RefObject } from 'react';
import { useMemo, useRef, useState, useEffect } from 'react';

const PREVIEW_SIZE_SMALL = 280;

interface UsePreviewSizeOptions {
  inline: boolean;
  isPreviewExpanded: boolean;
  isMobile: boolean;
  isTablet: boolean;
}

interface UsePreviewSizeResult {
  containerRef: RefObject<HTMLDivElement | null>;
  previewSize: number;
}

/**
 * Manages preview container sizing via ResizeObserver (inline mode)
 * and responsive viewport calculation (expanded mode).
 */
export function usePreviewSize({
  inline,
  isPreviewExpanded,
  isMobile,
  isTablet,
}: UsePreviewSizeOptions): UsePreviewSizeResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Track container dimensions in inline mode
  useEffect(() => {
    if (!inline || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [inline]);

  // Calculate preview size based on mode, expanded state, and device
  const previewSize = useMemo(() => {
    // In inline mode, use container dimensions (square aspect ratio)
    if (inline && containerSize.width > 0 && containerSize.height > 0) {
      return Math.min(containerSize.width, containerSize.height);
    }

    if (!isPreviewExpanded) return PREVIEW_SIZE_SMALL;

    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;

    if (isMobile) {
      // Mobile: nearly fullscreen (98% of viewport)
      return Math.min(vw * 0.98, vh * 0.98);
    } else if (isTablet) {
      // Tablet: large but with some margin (95%)
      return Math.min(vw * 0.95, vh * 0.95);
    } else {
      // Desktop: fill most of viewport (90%)
      return Math.min(vw * 0.9, vh * 0.9);
    }
  }, [inline, containerSize, isPreviewExpanded, isMobile, isTablet]);

  return { containerRef, previewSize };
}
