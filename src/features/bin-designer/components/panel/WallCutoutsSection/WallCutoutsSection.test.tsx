import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WallCutoutsSection } from './WallCutoutsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('WallCutoutsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders wall cutouts toggle', () => {
    render(<WallCutoutsSection />);
    const labels = screen.getAllByText('Wall cutouts');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('toggles the interior wall cutout through the store', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          interior: { ...DEFAULT_BIN_PARAMS.walls.interior, enabled: false },
        },
      },
    });
    render(<WallCutoutsSection />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Interior walls' }));

    expect(useDesignerStore.getState().params.walls.interior.enabled).toBe(true);
  });

  it('shows side chips and controls when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    render(<WallCutoutsSection />);
    // Toggle chips visible (active sides appear twice: chip + section header)
    expect(screen.getAllByText('Left').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Right').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Front')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
    expect(screen.getByText('Interior walls')).toBeDefined();

    // Span/Height labels visible (L/R are enabled by default)
    const spanElements = screen.getAllByText('Span');
    expect(spanElements.length).toBeGreaterThanOrEqual(1);
  });

  describe('corner radii', () => {
    const enabled = () =>
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
        },
      });

    it('summarises the built-in rule as square shoulders with an auto fillet', () => {
      enabled();
      render(<WallCutoutsSection />);
      expect(screen.getAllByText('Square / Auto').length).toBeGreaterThanOrEqual(1);
    });

    /** The disclosure is collapsed until a radius is set, so open it first. */
    const openCorners = (): void => {
      fireEvent.click(screen.getAllByRole('button', { name: /Corners/ })[0]);
    };

    it('writes a top radius to every active side while linked', () => {
      enabled();
      render(<WallCutoutsSection />);
      openCorners();

      const input = screen.getAllByLabelText('Top corner radius (mm)')[0];
      fireEvent.change(input, { target: { value: '4' } });
      fireEvent.blur(input);

      const { walls } = useDesignerStore.getState().params;
      expect(walls.left.cornerRadiusTop).toBe(4);
      expect(walls.right.cornerRadiusTop).toBe(4);
    });

    it('steps the bottom fillet off Auto onto an explicit value', () => {
      enabled();
      render(<WallCutoutsSection />);
      openCorners();
      // Auto is a real state, not a zero, so it has no number to read until
      // the user leaves it — and an untouched design carries no field at all.
      expect(useDesignerStore.getState().params.walls.left.cornerRadiusBottom).toBeUndefined();

      fireEvent.click(screen.getAllByRole('button', { name: 'Auto' })[0]);

      expect(useDesignerStore.getState().params.walls.left.cornerRadiusBottom).toBe(2);
    });

    it('puts the bottom fillet back on Auto', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          walls: {
            ...DEFAULT_BIN_PARAMS.walls,
            enabled: true,
            left: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusBottom: 3 },
            right: { ...DEFAULT_BIN_PARAMS.walls.right, cornerRadiusBottom: 3 },
          },
        },
      });
      render(<WallCutoutsSection />);

      fireEvent.click(screen.getAllByRole('button', { name: 'Auto' })[0]);

      expect(useDesignerStore.getState().params.walls.left.cornerRadiusBottom).toBeNull();
    });

    it('opens itself when a radius is already set, so the value is never hidden', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          walls: {
            ...DEFAULT_BIN_PARAMS.walls,
            enabled: true,
            left: { ...DEFAULT_BIN_PARAMS.walls.left, cornerRadiusTop: 4 },
            right: { ...DEFAULT_BIN_PARAMS.walls.right, cornerRadiusTop: 4 },
          },
        },
      });
      render(<WallCutoutsSection />);
      // Auto-opened, so the radius control itself is visible; the compact
      // summary only renders while the disclosure is closed.
      expect(screen.getAllByLabelText('Top corner radius (mm)').length).toBeGreaterThanOrEqual(1);
      const disclosure = screen
        .getAllByRole('button', { name: /corner/i })
        .find((b) => b.getAttribute('aria-expanded') !== null);
      expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('shows disabled reason for solid bins', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'solid' },
    });

    render(<WallCutoutsSection />);
    expect(screen.getByText(/Not available/)).toBeDefined();
  });

  it('does not show controls when disabled', () => {
    render(<WallCutoutsSection />);
    expect(screen.queryByText('Left')).toBeNull();
  });

  it('renders shape selector buttons when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    render(<WallCutoutsSection />);
    expect(screen.getByText('U-Shape')).toBeDefined();
    expect(screen.getByText('Scoop')).toBeDefined();
    expect(screen.getByText('Funnel')).toBeDefined();
  });

  it('shows the density hint on a high-compartment bin with cutouts enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: { cols: 1, rows: 9, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    render(<WallCutoutsSection />);
    expect(screen.getByText(/stack of slats/)).toBeDefined();
  });

  it('hides the density hint on a low-compartment bin', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    render(<WallCutoutsSection />);
    expect(screen.queryByText(/stack of slats/)).toBeNull();
  });
});
