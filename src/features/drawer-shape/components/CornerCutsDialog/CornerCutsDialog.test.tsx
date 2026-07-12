import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import type { DrawerOutline } from '@/core/types';
import { CornerCutsDialog } from './CornerCutsDialog';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const mockSetDrawerOutline = vi.fn(() => ({ ok: true, value: undefined }));
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ setDrawerOutline: mockSetDrawerOutline }),
}));

function kindSelect(cornerKey: string): HTMLSelectElement {
  return screen.getByRole('combobox', {
    name: `drawerShape.corners.${cornerKey}`,
  });
}

describe('CornerCutsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('applies a chamfer as an outline with corners authoring', () => {
    const onClose = vi.fn();
    render(<CornerCutsDialog open onClose={onClose} />);
    fireEvent.change(kindSelect('backRight'), { target: { value: 'chamfer' } });
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));

    expect(mockSetDrawerOutline).toHaveBeenCalledTimes(1);
    const outline = mockSetDrawerOutline.mock.calls[0][0] as DrawerOutline;
    expect(outline.authoring?.kind).toBe('corners');
    expect(outline.authoring?.corners?.tr.kind).toBe('chamfer');
    expect(onClose).toHaveBeenCalled();
  });

  it('clears the outline when every corner returns to none', () => {
    render(<CornerCutsDialog open onClose={() => {}} />);
    fireEvent.change(kindSelect('frontLeft'), { target: { value: 'radius' } });
    fireEvent.change(kindSelect('frontLeft'), { target: { value: 'none' } });
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    expect(mockSetDrawerOutline).toHaveBeenCalledWith(null);
  });

  it('seeds from an existing corners outline for round-trip editing', () => {
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        drawer: {
          ...s.layout.drawer,
          outline: {
            vertices: [
              { x: 30, y: 0 },
              { x: 168, y: 0 },
              { x: 168, y: 168 },
              { x: 0, y: 168 },
              { x: 0, y: 30 },
            ],
            authoring: {
              kind: 'corners',
              corners: {
                tl: { kind: 'none' },
                tr: { kind: 'none' },
                bl: { kind: 'chamfer', size: 30 },
                br: { kind: 'none' },
              },
            },
          } as DrawerOutline,
        },
      },
    }));
    render(<CornerCutsDialog open onClose={() => {}} />);
    expect(kindSelect('frontLeft').value).toBe('chamfer');
  });

  it('confirms before replacing a shape drawn with another editor', () => {
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        drawer: {
          ...s.layout.drawer,
          outline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 168, y: 0 },
              { x: 168, y: 84 },
              { x: 84, y: 84 },
              { x: 84, y: 168 },
              { x: 0, y: 168 },
            ],
            authoring: { kind: 'cells' },
          } as DrawerOutline,
        },
      },
    }));
    render(<CornerCutsDialog open onClose={() => {}} />);
    fireEvent.change(kindSelect('backLeft'), { target: { value: 'radius' } });
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    expect(mockSetDrawerOutline).not.toHaveBeenCalled();
    expect(screen.getByText('drawerShape.corners.replaceTitle')).toBeInTheDocument();
  });
});

describe('review regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('stepper +/- steps from the current value (delta semantics)', () => {
    render(<CornerCutsDialog open onClose={() => {}} />);
    fireEvent.change(kindSelect('backRight'), { target: { value: 'chamfer' } });
    // Default seed is 21mm; one + click must yield 22, not 1.
    const plus = screen.getAllByRole('button', { name: /increase|increment|\+/i })[0];
    fireEvent.click(plus);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    const outline = mockSetDrawerOutline.mock.calls[0][0] as {
      authoring?: { corners?: { tr: { kind: string; size?: number } } };
    };
    expect(outline.authoring?.corners?.tr).toEqual({ kind: 'chamfer', size: 22 });
  });

  it('treats a corners outline with a stripped annotation as foreign (confirms)', () => {
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        drawer: {
          ...s.layout.drawer,
          outline: {
            vertices: [
              { x: 30, y: 0 },
              { x: 168, y: 0 },
              { x: 168, y: 168 },
              { x: 0, y: 168 },
              { x: 0, y: 30 },
            ],
            // An older server stripped `corners` — only the kind survived.
            authoring: { kind: 'corners' },
          } as never,
        },
      },
    }));
    render(<CornerCutsDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    expect(mockSetDrawerOutline).not.toHaveBeenCalled();
    expect(screen.getByText('drawerShape.corners.replaceTitle')).toBeInTheDocument();
  });
});
