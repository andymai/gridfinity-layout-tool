import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CutoutCanvas } from './CutoutCanvas';

describe('CutoutCanvas', () => {
  it('exports a function', () => {
    expect(typeof CutoutCanvas).toBe('function');
  });

  it('renders an SVG canvas element', () => {
    const { container } = render(
      <CutoutCanvas
        cutouts={[]}
        binWidth={40}
        binDepth={40}
        canvasWidth={200}
        canvasHeight={200}
        scale={5}
        selection={new Set()}
        preview={new Map()}
        mode={{ type: 'idle' }}
        drawingPreview={null}
        activeGuides={[]}
        marquee={null}
        onCanvasPointerDown={vi.fn()}
        onCanvasPointerMove={vi.fn()}
        onCanvasPointerUp={vi.fn()}
        onContextMenu={vi.fn()}
        svgRef={{ current: null }}
        onSelectCutout={vi.fn()}
        onDoubleClickCutout={vi.fn()}
        onResizeStart={vi.fn()}
        onRotateStart={vi.fn()}
        onGroupRotateStart={vi.fn()}
        onGroupScaleStart={vi.fn()}
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
