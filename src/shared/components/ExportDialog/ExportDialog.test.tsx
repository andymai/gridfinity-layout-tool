import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExportDialog } from './ExportDialog';
import type { ExportDialogProps } from './ExportDialog';

const defaultProps: ExportDialogProps = {
  open: true,
  onClose: vi.fn(),
  activeFormat: 'stl',
  fileNameConfig: { style: 'descriptive', customName: '', format: 'stl' },
  onFileNameConfigChange: vi.fn(),
  fileName: 'gridfinity_2x3x6.stl',
  displayExtension: '.stl',
  canExport: true,
  isExporting: false,
  onDownload: vi.fn(),
};

describe('ExportDialog', () => {
  it('renders when open', () => {
    render(<ExportDialog {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ExportDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows format radio buttons with active format checked', () => {
    render(<ExportDialog {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    const stlRadio = screen.getByRole('radio', { name: 'STL' });
    expect(stlRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('updates fileNameConfig format when format button clicked', () => {
    const onFileNameConfigChange = vi.fn();
    render(<ExportDialog {...defaultProps} onFileNameConfigChange={onFileNameConfigChange} />);
    fireEvent.click(screen.getByText('STEP'));
    expect(onFileNameConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'step' })
    );
  });

  it('displays filename without extension', () => {
    render(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('gridfinity_2x3x6')).toBeInTheDocument();
    expect(screen.getByText('.stl')).toBeInTheDocument();
  });

  it('shows name style buttons', () => {
    render(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('Descriptive')).toBeInTheDocument();
    expect(screen.getByText('Compact')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('shows progress bar when exportProgress provided', () => {
    render(
      <ExportDialog {...defaultProps} isExporting exportProgress={{ current: 3, total: 8 }} />
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/3.*8/)).toBeInTheDocument();
  });

  it('shows split banner when provided', () => {
    const onCheckedChange = vi.fn();
    render(
      <ExportDialog
        {...defaultProps}
        splitBanner={{
          message: 'Split needed',
          checkboxLabel: 'Enable split',
          checked: true,
          onCheckedChange,
        }}
      />
    );
    expect(screen.getByText('Split needed')).toBeInTheDocument();
    expect(screen.getByText('Enable split')).toBeInTheDocument();
  });

  it('shows estimates when provided', () => {
    render(
      <ExportDialog
        {...defaultProps}
        estimates={[
          { label: 'Weight', value: '12g' },
          { label: 'Time', value: '1h 20m' },
        ]}
        estimatesTitle="Print Estimates"
      />
    );
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('12g')).toBeInTheDocument();
    expect(screen.getByText('Print Estimates')).toBeInTheDocument();
  });

  it('disables download when canExport is false', () => {
    render(<ExportDialog {...defaultProps} canExport={false} noMeshWarning="No mesh" />);
    const downloadBtn = screen.getByRole('button', { name: /download/i });
    expect(downloadBtn).toBeDisabled();
    expect(screen.getByText('No mesh')).toBeInTheDocument();
  });

  it('calls onDownload when download button clicked', () => {
    const onDownload = vi.fn();
    render(<ExportDialog {...defaultProps} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(onDownload).toHaveBeenCalled();
  });

  it('shows secondary download when visible', () => {
    const onClick = vi.fn();
    render(
      <ExportDialog
        {...defaultProps}
        secondaryDownload={{
          label: 'Download Dividers',
          isExporting: false,
          onClick,
          visible: true,
        }}
      />
    );
    expect(screen.getByText('Download Dividers')).toBeInTheDocument();
  });

  describe('formatStates', () => {
    it('marks disabled formats with aria-disabled and exposes the reason as a tooltip', () => {
      render(
        <ExportDialog
          {...defaultProps}
          activeFormat="3mf"
          fileNameConfig={{ ...defaultProps.fileNameConfig, format: '3mf' }}
          formatStates={{
            stl: { disabled: true, reason: 'STL loses color data' },
            step: { disabled: true, reason: 'STEP loses color data' },
          }}
        />
      );
      const stl = screen.getByRole('radio', { name: 'STL' });
      expect(stl).toHaveAttribute('aria-disabled', 'true');
      expect(stl).toHaveAttribute('title', 'STL loses color data');
    });

    it('does not call onChange when a disabled format is clicked', () => {
      const onFileNameConfigChange = vi.fn();
      render(
        <ExportDialog
          {...defaultProps}
          activeFormat="3mf"
          fileNameConfig={{ ...defaultProps.fileNameConfig, format: '3mf' }}
          onFileNameConfigChange={onFileNameConfigChange}
          formatStates={{ stl: { disabled: true, reason: 'no colors' } }}
        />
      );
      fireEvent.click(screen.getByRole('radio', { name: 'STL' }));
      expect(onFileNameConfigChange).not.toHaveBeenCalled();
    });

    it('skips disabled formats during arrow-key navigation', () => {
      const onFileNameConfigChange = vi.fn();
      render(
        <ExportDialog
          {...defaultProps}
          activeFormat="3mf"
          fileNameConfig={{ ...defaultProps.fileNameConfig, format: '3mf' }}
          onFileNameConfigChange={onFileNameConfigChange}
          formatStates={{
            stl: { disabled: true, reason: 'no colors' },
            step: { disabled: true, reason: 'no colors' },
          }}
        />
      );
      // ArrowRight from 3MF would normally hit STL, then STEP. Both disabled,
      // so the only enabled option is 3MF — no change should fire.
      fireEvent.keyDown(screen.getByRole('radio', { name: '3MF' }), { key: 'ArrowRight' });
      expect(onFileNameConfigChange).not.toHaveBeenCalled();
    });
  });
});
