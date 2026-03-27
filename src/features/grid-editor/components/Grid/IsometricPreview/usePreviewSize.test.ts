import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePreviewSize } from './usePreviewSize';

describe('usePreviewSize', () => {
  it('returns small preview size when not expanded', () => {
    const { result } = renderHook(() =>
      usePreviewSize({
        inline: false,
        isPreviewExpanded: false,
        isMobile: false,
        isTablet: false,
      })
    );

    expect(result.current.previewSize).toBe(280);
  });

  it('returns viewport-based size when expanded on desktop', () => {
    const { result } = renderHook(() =>
      usePreviewSize({
        inline: false,
        isPreviewExpanded: true,
        isMobile: false,
        isTablet: false,
      })
    );

    // Desktop: 90% of viewport
    expect(result.current.previewSize).toBeGreaterThan(280);
  });

  it('returns containerRef', () => {
    const { result } = renderHook(() =>
      usePreviewSize({
        inline: false,
        isPreviewExpanded: false,
        isMobile: false,
        isTablet: false,
      })
    );

    expect(result.current.containerRef).toBeDefined();
    expect(result.current.containerRef.current).toBeNull();
  });

  it('falls back to PREVIEW_SIZE_SMALL for inline mode without container dimensions', () => {
    const { result } = renderHook(() =>
      usePreviewSize({
        inline: true,
        isPreviewExpanded: false,
        isMobile: false,
        isTablet: false,
      })
    );

    // Inline mode with no container: falls through to PREVIEW_SIZE_SMALL
    expect(result.current.previewSize).toBe(280);
  });
});
