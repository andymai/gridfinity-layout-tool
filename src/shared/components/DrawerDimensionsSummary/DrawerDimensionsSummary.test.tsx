import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { gridUnits } from '@/core/types';
import { DrawerDimensionsSummary } from './DrawerDimensionsSummary';

describe('DrawerDimensionsSummary', () => {
  const defaultProps = {
    measuredMm: undefined,
    gridWidthMm: 420,
    gridDepthMm: 336,
    gridHeightMm: 84,
    minMm: 1,
    maxMm: 5000,
    minHeightMm: 7,
    maxHeightMm: 350,
    onCommit: vi.fn(),
    suggestion: null,
    onAcceptSuggestion: vi.fn(),
    onDismissSuggestion: vi.fn(),
    onClearMeasurement: vi.fn(),
    ceiling: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the derived grid mm when no measurement exists, with no fit line or clear button', () => {
    render(<DrawerDimensionsSummary {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: 'Edit measured drawer dimensions' })
    ).toHaveTextContent(/420\s*×\s*336\s*×\s*84\s*mm/);
    expect(screen.queryByText(/free/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear measurement' })).not.toBeInTheDocument();
  });

  it('shows the measured size, the grid fit, and per-axis free space', () => {
    render(
      <DrawerDimensionsSummary
        {...defaultProps}
        measuredMm={{ width: 450, depth: 380, height: 90 }}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Edit measured drawer dimensions' })
    ).toHaveTextContent(/450\s*×\s*380\s*×\s*90\s*mm/);
    expect(screen.getByText('Grid 420 × 336 mm · 30 × 44 mm free')).toBeInTheDocument();
  });

  it('warns when the grid exceeds the measured drawer', () => {
    render(<DrawerDimensionsSummary {...defaultProps} measuredMm={{ width: 400, depth: 380 }} />);

    expect(screen.getByText('Grid exceeds your measured drawer by 20 × 0 mm')).toBeInTheDocument();
    expect(screen.queryByText(/free/)).not.toBeInTheDocument();
  });

  it('commits typed mm, dropping the seeded height the user never edited', () => {
    render(<DrawerDimensionsSummary {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit measured drawer dimensions' }));

    fireEvent.change(screen.getByLabelText('Measured width (mm)'), { target: { value: '450' } });
    fireEvent.change(screen.getByLabelText('Measured depth (mm)'), { target: { value: '380' } });
    fireEvent.keyDown(screen.getByLabelText('Measured depth (mm)'), { key: 'Enter' });

    expect(defaultProps.onCommit).toHaveBeenCalledWith(450, 380, undefined);
  });

  it('commits an edited height as measured', () => {
    render(<DrawerDimensionsSummary {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit measured drawer dimensions' }));

    fireEvent.change(screen.getByLabelText('Measured height (mm)'), { target: { value: '90' } });
    fireEvent.keyDown(screen.getByLabelText('Measured height (mm)'), { key: 'Enter' });

    expect(defaultProps.onCommit).toHaveBeenCalledWith(420, 336, 90);
  });

  it('keeps an existing measured height on an unchanged commit', () => {
    render(
      <DrawerDimensionsSummary
        {...defaultProps}
        measuredMm={{ width: 450, depth: 380, height: 90 }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit measured drawer dimensions' }));

    fireEvent.change(screen.getByLabelText('Measured width (mm)'), { target: { value: '460' } });
    fireEvent.keyDown(screen.getByLabelText('Measured width (mm)'), { key: 'Enter' });

    expect(defaultProps.onCommit).toHaveBeenCalledWith(460, 380, 90);
  });

  it('fires onClearMeasurement from the clear button', () => {
    render(<DrawerDimensionsSummary {...defaultProps} measuredMm={{ width: 450, depth: 380 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear measurement' }));

    expect(defaultProps.onClearMeasurement).toHaveBeenCalledTimes(1);
  });

  it('renders a half-unit fit suggestion with accept and dismiss actions', () => {
    render(
      <DrawerDimensionsSummary
        {...defaultProps}
        measuredMm={{ width: 450, depth: 380 }}
        suggestion={{
          width: gridUnits(10.5),
          depth: gridUnits(9),
          slackWidthMm: 9,
          slackDepthMm: 2,
          isHalf: true,
        }}
      />
    );

    expect(screen.getByText('10.5 × 9 units fits your drawer')).toBeInTheDocument();
    expect(screen.getByText('Leaves 9 × 2 mm free.')).toBeInTheDocument();
    // Half-unit fits warn that accepting turns half-grid on.
    expect(screen.getByText('Turns on half-grid mode.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fit grid' }));
    expect(defaultProps.onAcceptSuggestion).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss suggestion' }));
    expect(defaultProps.onDismissSuggestion).toHaveBeenCalledTimes(1);
  });

  it('omits the half-grid note for a whole-unit fit', () => {
    render(
      <DrawerDimensionsSummary
        {...defaultProps}
        measuredMm={{ width: 450, depth: 380 }}
        suggestion={{
          width: gridUnits(10),
          depth: gridUnits(9),
          slackWidthMm: 30,
          slackDepthMm: 2,
          isHalf: false,
        }}
      />
    );

    expect(screen.getByText('10 × 9 units fits your drawer')).toBeInTheDocument();
    expect(screen.queryByText('Turns on half-grid mode.')).not.toBeInTheDocument();
  });

  it('does not render a suggestion box when there is none', () => {
    render(<DrawerDimensionsSummary {...defaultProps} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  describe('drawer ceiling', () => {
    const ceiling = (over: { fits: boolean; slackMm: number }) => ({
      ceilingMm: 55,
      tallestMm: 55 - over.slackMm,
      slackMm: over.slackMm,
      fits: over.fits,
      overflowing: [],
    });

    it('prompts for a height measurement when the drawer is unmeasured', () => {
      render(<DrawerDimensionsSummary {...defaultProps} ceiling={null} />);
      expect(
        screen.getByText('Add a height measurement to check the lid closes')
      ).toBeInTheDocument();
    });

    it('reports the spare headroom when the layout fits', () => {
      render(
        <DrawerDimensionsSummary
          {...defaultProps}
          ceiling={ceiling({ fits: true, slackMm: 8.7 })}
        />
      );
      expect(screen.getByText('Tallest stack fits, 8.7mm to spare')).toBeInTheDocument();
    });

    // The reported failure: the app says the drawer is full, the print is proud
    // of it by the stacking lip, and the lid does not close.
    it('warns with the overshoot when the layout stands proud', () => {
      render(
        <DrawerDimensionsSummary
          {...defaultProps}
          ceiling={ceiling({ fits: false, slackMm: -4.25 })}
        />
      );
      expect(
        screen.getByText('Tallest stack stands 4.3mm above your measured drawer')
      ).toBeInTheDocument();
    });
  });
});
