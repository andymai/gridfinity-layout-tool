// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: () => {} }));

import { VersionHistory } from './VersionHistory';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useDesignVersionStore } from '@/features/bin-designer/store/versionStore';
import { closeDesignerDb } from '@/features/bin-designer/storage/designerDb';
import { saveDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { createDesignVersion } from '@/features/bin-designer/storage/DesignVersionService';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { expectOk } from '@/test/testUtils';
import { designId } from '@/core/types';

const DESIGN = designId('design_history_test');

async function seedDesign() {
  expectOk(
    await saveDesign({
      id: DESIGN,
      name: 'Router Bit Holder',
      params: DEFAULT_BIN_PARAMS,
      thumbnail: null,
      exportFileNameConfig: null,
    })
  );
  useDesignerStore.getState().setCurrentDesignId(DESIGN);
  useDesignerStore.getState().setDesignName('Router Bit Holder');
}

describe('VersionHistory', () => {
  beforeEach(async () => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignVersionStore.getState().reset();
    closeDesignerDb();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gridfinity-designer-v1');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(req.error?.message ?? 'delete failed'));
    });
  });

  it('tells an unsaved design it has nowhere to keep versions', () => {
    render(<VersionHistory open onClose={vi.fn()} />);
    expect(screen.getByText('binDesigner.versions.unsavedDesign')).toBeInTheDocument();
  });

  it('invites a first version when the design has none', async () => {
    await seedDesign();
    render(<VersionHistory open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('binDesigner.versions.emptyBody')).toBeInTheDocument();
    });
  });

  it('lists stored versions', async () => {
    await seedDesign();
    expectOk(
      await createDesignVersion(DESIGN, '0.2 mm — tight', { name: 'Router Bit Holder' }, null)
    );

    render(<VersionHistory open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('0.2 mm — tight')).toBeInTheDocument();
    });
  });

  it('saves a named version from the working state', async () => {
    await seedDesign();
    render(<VersionHistory open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByText('binDesigner.versions.save'));
    fireEvent.change(screen.getByLabelText('binDesigner.versions.namePlaceholder'), {
      target: { value: 'Printed successfully' },
    });
    fireEvent.click(screen.getByText('binDesigner.versions.confirmSave'));

    await waitFor(() => {
      expect(screen.getByText('Printed successfully')).toBeInTheDocument();
    });
  });

  it('falls back to the design name when no version name is typed', async () => {
    await seedDesign();
    render(<VersionHistory open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByText('binDesigner.versions.save'));
    fireEvent.click(screen.getByText('binDesigner.versions.confirmSave'));

    await waitFor(() => {
      const names = useDesignVersionStore.getState().versions.map((v) => v.name);
      expect(names).toContain('Router Bit Holder');
    });
  });

  // The whole safety argument for restore rests on this ordering: the copy of
  // what you are leaving must exist before it is overwritten.
  it('captures the current state as a pre-restore version before restoring', async () => {
    await seedDesign();
    useDesignerStore.getState().setParams({ width: 4 });
    expectOk(
      await createDesignVersion(
        DESIGN,
        'narrow',
        { name: 'Router Bit Holder', params: { ...DEFAULT_BIN_PARAMS, width: 1 } },
        null
      )
    );

    const onClose = vi.fn();
    render(<VersionHistory open onClose={onClose} />);

    fireEvent.click(await screen.findByText('binDesigner.versions.restore'));
    const confirmButtons = screen.getAllByText('binDesigner.versions.restore');
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(useDesignerStore.getState().params.width).toBe(1);
    });

    const backup = useDesignVersionStore
      .getState()
      .versions.find((v) => v.origin === 'pre-restore');
    expect(backup).toBeDefined();
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves the restore undoable in one step', async () => {
    await seedDesign();
    useDesignerStore.getState().setParams({ width: 4 });
    expectOk(
      await createDesignVersion(
        DESIGN,
        'narrow',
        { name: 'Router Bit Holder', params: { ...DEFAULT_BIN_PARAMS, width: 1 } },
        null
      )
    );

    render(<VersionHistory open onClose={vi.fn()} />);
    fireEvent.click(await screen.findByText('binDesigner.versions.restore'));
    const confirmButtons = screen.getAllByText('binDesigner.versions.restore');
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(useDesignerStore.getState().params.width).toBe(1);
    });

    useDesignerStore.getState().undo();
    expect(useDesignerStore.getState().params.width).toBe(4);
  });

  // Restoring with no checkpoint written is the exact outcome the pre-restore
  // capture exists to prevent, so a failed capture must abort the restore.
  it('does not restore when the pre-restore capture fails', async () => {
    await seedDesign();
    useDesignerStore.getState().setParams({ width: 4 });
    expectOk(
      await createDesignVersion(
        DESIGN,
        'narrow',
        { name: 'Router Bit Holder', params: { ...DEFAULT_BIN_PARAMS, width: 1 } },
        null
      )
    );

    const saveVersion = vi
      .spyOn(useDesignVersionStore.getState(), 'saveVersion')
      .mockResolvedValue(null);
    useDesignVersionStore.setState({ saveVersion });

    const onClose = vi.fn();
    render(<VersionHistory open onClose={onClose} />);
    fireEvent.click(await screen.findByText('binDesigner.versions.restore'));
    const confirmButtons = screen.getAllByText('binDesigner.versions.restore');
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(saveVersion).toHaveBeenCalled();
    });
    expect(useDesignerStore.getState().params.width).toBe(4);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes a version from the list when deleted', async () => {
    await seedDesign();
    expectOk(await createDesignVersion(DESIGN, 'doomed', { name: 'Router Bit Holder' }, null));

    render(<VersionHistory open onClose={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText('community.detail.moreActions'));
    fireEvent.click(screen.getByText('binDesigner.versions.delete'));
    const confirm = screen.getAllByText('binDesigner.versions.delete');
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('doomed')).toBeNull();
    });
  });
});
