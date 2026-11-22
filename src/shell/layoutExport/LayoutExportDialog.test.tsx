import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, act } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { binId, designId } from '@/core/types';
import { LayoutExportDialog } from './LayoutExportDialog';

// Capture what the shared dialog is asked to render rather than asserting on
// its internals — the branch under test is which empty-state copy is chosen.
const exportDialogProps = vi.fn();
const shouldPromptSupport = vi.fn<() => boolean>();
vi.mock('@/shared/components/ExportDialog', () => ({
  ExportDialog: (props: Record<string, unknown>) => {
    exportDialogProps(props);
    return null;
  },
  ExportSupportPrompt: () => null,
  recordExportAndShouldPromptSupport: () => shouldPromptSupport(),
}));

const exportLayout = vi.fn<() => Promise<boolean>>();
vi.mock('./useLayoutExport', () => ({
  useLayoutExport: () => ({
    isExporting: false,
    exportProgress: null,
    exportLayout,
  }),
}));

function lastProps(): Record<string, unknown> {
  const calls = exportDialogProps.mock.calls;
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe('LayoutExportDialog', () => {
  beforeEach(() => {
    exportDialogProps.mockClear();
    shouldPromptSupport.mockReset();
    exportLayout.mockReset();
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

  describe('after a download', () => {
    function renderLinked(onClose = vi.fn()) {
      useLayoutStore.setState({
        layout: createTestLayout({
          bins: [createTestBin({ id: binId('linked'), linkedDesignId: designId('design-1') })],
        }),
      });
      render(<LayoutExportDialog open onClose={onClose} />);
      return onClose;
    }

    async function download() {
      await act(async () => {
        await (lastProps().onDownload as () => Promise<void>)();
      });
    }

    it('shows the support view when the gate allows it', async () => {
      exportLayout.mockResolvedValue(true);
      shouldPromptSupport.mockReturnValue(true);
      const onClose = renderLinked();

      await download();

      expect(lastProps().exported).toBe(true);
      expect(lastProps().successContent).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('names the file that downloaded, even if the name changes during export', async () => {
      let finish: (ok: boolean) => void = () => {};
      exportLayout.mockReturnValue(
        new Promise<boolean>((resolve) => {
          finish = resolve;
        })
      );
      shouldPromptSupport.mockReturnValue(true);
      renderLinked();
      const startedAs = lastProps().fileName;

      let pending: Promise<void> = Promise.resolve();
      act(() => {
        pending = (lastProps().onDownload as () => Promise<void>)();
      });
      act(() => {
        (lastProps().onFileNameConfigChange as (c: unknown) => void)({
          style: 'custom',
          customName: 'renamed',
          format: 'stl',
        });
      });
      await act(async () => {
        finish(true);
        await pending;
      });

      expect(lastProps().fileName).toBe('renamed.zip');
      const prompt = lastProps().successContent as ReactElement<{ fileName: string }>;
      expect(prompt.props.fileName).toBe(startedAs);
    });

    it('closes as before when the gate declines', async () => {
      exportLayout.mockResolvedValue(true);
      shouldPromptSupport.mockReturnValue(false);
      const onClose = renderLinked();

      await download();

      expect(lastProps().exported).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('neither counts nor closes a failed export', async () => {
      exportLayout.mockResolvedValue(false);
      const onClose = renderLinked();

      await download();

      expect(shouldPromptSupport).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
