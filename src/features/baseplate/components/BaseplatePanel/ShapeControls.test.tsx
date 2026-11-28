import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { resetAllStores } from '@/test/testUtils';
import type { ShapeEditorSlot } from '../../types/shapeEditor';
import { ShapeControls } from './ShapeControls';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const ShapeEditor: ShapeEditorSlot = ({ disabledReason }) => (
  <div data-testid="shape-editor" data-reason={disabledReason ?? ''} />
);

function setSynced(synced: boolean): void {
  useLayoutStore.getState().setBaseplateParams({
    ...DEFAULT_BASEPLATE_PARAMS,
    syncWithLayout: synced,
  });
}

describe('ShapeControls', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('offers the shape editor while the plate follows the layout', () => {
    setSynced(true);
    render(<ShapeControls shapeEditor={ShapeEditor} />);
    expect(screen.getByTestId('shape-editor')).toHaveAttribute('data-reason', '');
  });

  // The editor changes the layout's drawer. A plate out of sync is a rectangle
  // of its own size, so an edit there would leave the plate as it was.
  it('disables the shape editor with a reason while the plate is out of sync', () => {
    setSynced(false);
    render(<ShapeControls shapeEditor={ShapeEditor} />);
    expect(screen.getByTestId('shape-editor')).toHaveAttribute(
      'data-reason',
      'baseplate.editShapeNeedsSync'
    );
  });

  it('renders no shape editor when the shell gives none', () => {
    render(<ShapeControls />);
    expect(screen.queryByTestId('shape-editor')).not.toBeInTheDocument();
  });

  it('adds the grid position once the synced drawer has a shape', () => {
    render(<ShapeControls shapeEditor={ShapeEditor} />);
    expect(screen.queryByText('baseplate.gridPosition')).not.toBeInTheDocument();

    act(() =>
      useLayoutStore.setState((s) => ({
        layout: {
          ...s.layout,
          drawer: {
            ...s.layout.drawer,
            outline: {
              vertices: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
              ],
            },
          },
        },
      }))
    );
    expect(screen.getByText('baseplate.gridPosition')).toBeInTheDocument();
  });
});
