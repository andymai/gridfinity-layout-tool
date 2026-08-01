/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useToastStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { useOutlineImport, type OutlineImportDeps } from './useOutlineImport';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const U = 42;

/** Closed square LWPOLYLINE of the given size, in millimetres. */
function squareDxf(size: number): string {
  const pairs: [number, string | number][] = [
    [0, 'SECTION'],
    [2, 'ENTITIES'],
    [0, 'LWPOLYLINE'],
    [90, 4],
    [70, 1],
    [10, 0],
    [20, 0],
    [10, size],
    [20, 0],
    [10, size],
    [20, size],
    [10, 0],
    [20, size],
    [0, 'ENDSEC'],
    [0, 'EOF'],
  ];
  return pairs.map(([c, v]) => `${c}\n${v}`).join('\n') + '\n';
}

function setup(overrides: Partial<OutlineImportDeps> = {}) {
  const onImported = vi.fn();
  const onGrowDrawer = vi.fn();
  const deps: OutlineImportDeps = {
    drawerWidthMm: 10 * U, // 420mm
    drawerDepthMm: 8 * U, // 336mm
    gridUnitMm: U,
    gridUnitMmY: U,
    onImported,
    onGrowDrawer,
    ...overrides,
  };
  const hook = renderHook(() => useOutlineImport(deps));
  return { ...hook, onImported, onGrowDrawer };
}

/** Drive a file through the hidden input the hook installs. */
async function pickFile(name: string, text: string): Promise<void> {
  const input = document.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  const file = new File([text], name, { type: 'text/plain' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    (input as HTMLInputElement).dispatchEvent(new Event('change'));
    // Let the FileReader and the dynamic import settle.
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('useOutlineImport', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('installs a picker that accepts SVG and DXF', () => {
    setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.svg,.dxf');
  });

  it('imports a DXF that fits, at its measured size', async () => {
    const { onImported } = setup();
    await pickFile('drawer.dxf', squareDxf(200));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    const verts = onImported.mock.calls[0][0];
    expect(verts).toHaveLength(4);
    const xs = verts.map((v: { x: number }) => v.x);
    // 200mm wide as measured, centred in the 420mm drawer.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(200, 6);
    expect(Math.min(...xs)).toBeCloseTo(110, 6);
  });

  it('imports an SVG through the same path', async () => {
    const { onImported } = setup();
    await pickFile(
      'drawer.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><path d="M 0 0 L 200 0 L 200 100 L 0 100 Z" /></svg>'
    );
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
  });

  // A measured drawer must not be silently rescaled, so an oversized file asks.
  it('asks rather than shrinking a shape that does not fit', async () => {
    const { result, onImported } = setup();
    await pickFile('big.dxf', squareDxf(900));
    await waitFor(() => expect(result.current.oversize).not.toBeNull());
    expect(onImported).not.toHaveBeenCalled();
    expect(result.current.oversize?.sourceWidthMm).toBeCloseTo(900, 6);
    // 900mm needs 21.5 units at a 42mm pitch.
    expect(result.current.oversize?.requiredWidthUnits).toBe(21.5);
    expect(result.current.oversize?.canGrow).toBe(true);
  });

  it('scales to fit when that is the choice', async () => {
    const { result, onImported } = setup();
    await pickFile('big.dxf', squareDxf(900));
    await waitFor(() => expect(result.current.oversize).not.toBeNull());

    await act(async () => {
      result.current.resolveOversize('scale');
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    const verts = onImported.mock.calls[0][0];
    const ys = verts.map((v: { y: number }) => v.y);
    // Squeezed onto the shorter axis: 336mm deep, not 900.
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(336, 6);
    expect(result.current.oversize).toBeNull();
  });

  // The outline is fitted against the drawer it is ABOUT to have, so the
  // resize and the shape land together instead of racing.
  it('grows the drawer and fits the shape to the new size in one go', async () => {
    const { result, onImported, onGrowDrawer } = setup();
    await pickFile('big.dxf', squareDxf(900));
    await waitFor(() => expect(result.current.oversize).not.toBeNull());

    await act(async () => {
      result.current.resolveOversize('grow');
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(onGrowDrawer).toHaveBeenCalledWith(21.5, 21.5);
    const verts = onImported.mock.calls[0][0];
    const xs = verts.map((v: { x: number }) => v.x);
    // True scale kept, and centred in the grown drawer (21.5u = 903mm).
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(900, 6);
    expect(Math.min(...xs)).toBeCloseTo((21.5 * U - 900) / 2, 6);
  });

  it('imports nothing when the prompt is cancelled', async () => {
    const { result, onImported, onGrowDrawer } = setup();
    await pickFile('big.dxf', squareDxf(900));
    await waitFor(() => expect(result.current.oversize).not.toBeNull());

    act(() => result.current.resolveOversize('cancel'));
    expect(result.current.oversize).toBeNull();
    expect(onImported).not.toHaveBeenCalled();
    expect(onGrowDrawer).not.toHaveBeenCalled();
  });

  it('refuses to grow past the maximum drawer size', async () => {
    const { result } = setup();
    // 50 units is the ceiling, so 2200mm cannot be accommodated by growing.
    await pickFile('huge.dxf', squareDxf(2200));
    await waitFor(() => expect(result.current.oversize).not.toBeNull());
    expect(result.current.oversize?.canGrow).toBe(false);
  });

  it.each([
    ['notes.dxf', 'this is not\na dxf file\nat all\n', 'toast.outlineImport.parseFailed'],
    ['open.dxf', squareDxf(200).replace('70\n1', '70\n0'), 'toast.outlineImport.noClosedLoop'],
    ['binary.dxf', 'AutoCAD Binary DXF\r\n', 'toast.outlineImport.binaryDxf'],
  ])('explains why %s could not be imported', async (name, text, key) => {
    const { onImported } = setup();
    await pickFile(name, text);
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((t) => t.message)).toContain(key)
    );
    expect(onImported).not.toHaveBeenCalled();
  });

  it('removes its picker on unmount', () => {
    const { unmount } = setup();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
    unmount();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
