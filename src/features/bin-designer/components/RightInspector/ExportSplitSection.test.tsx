import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportSplitSection } from './ExportSplitSection';

describe('ExportSplitSection', () => {
  it('invokes onExport when the action is clicked', () => {
    const onExport = vi.fn();
    render(
      <ExportSplitSection
        format="stl"
        needsSplit={false}
        splitPieceCount={1}
        canExport
        onExport={onExport}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('disables the action when export is not ready', () => {
    render(
      <ExportSplitSection
        format="stl"
        needsSplit
        splitPieceCount={4}
        canExport={false}
        onExport={() => {}}
      />
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
