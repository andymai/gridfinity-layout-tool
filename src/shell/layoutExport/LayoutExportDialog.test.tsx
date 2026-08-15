import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { binId, designId } from '@/core/types';
import { LayoutExportDialog } from './LayoutExportDialog';

// Capture what the shared dialog is asked to render rather than asserting on
// its internals — the branch under test is which empty-state copy is chosen.
const exportDialogProps = vi.fn();
vi.mock('@/shared/components/ExportDialog', () => ({
  ExportDialog: (props: Record<string, unknown>) => {
    exportDialogProps(props);
    return null;
  },
}));

vi.mock('./useLayoutExport', () => ({
  useLayoutExport: () => ({
    isExporting: false,
    exportProgress: null,
    exportLayout: vi.fn(),
  }),
}));

function lastProps(): Record<string, unknown> {
  const calls = exportDialogProps.mock.calls;
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe('LayoutExportDialog', () => {
  beforeEach(() => {
    exportDialogProps.mockClear();
  });

  it('explains the linking gap when bins exist but none are linked', () => {
    useLayoutStore.setState({
      layout: createTestLayout({ bins: [createTestBin({ id: binId('unlinked') })] }),
    });

    render(<LayoutExportDialog open onClose={vi.fn()} />);

    expect(lastProps().noMeshWarning).toBe(
      "No bins here are linked to a saved design yet, so there's no geometry to export. Open a bin and choose a design to link it."
    );
    expect(lastProps().canExport).toBe(false);
  });

  // An empty layout is not a linking problem, and the previous single string
  // read as though it were — it told a user with nothing drawn to go link bins
  // that do not exist.
  it('tells an empty layout to draw a bin, not to link one', () => {
    useLayoutStore.setState({ layout: createTestLayout({ bins: [] }) });

    render(<LayoutExportDialog open onClose={vi.fn()} />);

    expect(lastProps().noMeshWarning).toBe(
      'This layout has no bins yet. Draw one on the grid to get started.'
    );
  });

  it('shows no warning and allows export once a bin is linked', () => {
    useLayoutStore.setState({
      layout: createTestLayout({
        bins: [createTestBin({ id: binId('linked'), linkedDesignId: designId('design-1') })],
      }),
    });

    render(<LayoutExportDialog open onClose={vi.fn()} />);

    expect(lastProps().noMeshWarning).toBeNull();
    expect(lastProps().canExport).toBe(true);
  });
});
