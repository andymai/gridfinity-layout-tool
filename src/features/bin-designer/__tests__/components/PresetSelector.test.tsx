import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetSelector } from '../../components/parameters/PresetSelector';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';
import { BUILT_IN_PRESETS } from '../../constants/presets';

const STORAGE_KEY = 'gridfinity-designer-presets';

describe('PresetSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('renders all built-in preset buttons', () => {
    render(<PresetSelector />);

    for (const preset of BUILT_IN_PRESETS) {
      expect(screen.getByLabelText(`Apply ${preset.name} preset`)).toBeInTheDocument();
    }
  });

  it('shows preset names', () => {
    render(<PresetSelector />);

    expect(screen.getByText('Heavy Duty')).toBeInTheDocument();
    expect(screen.getByText('Quick Print')).toBeInTheDocument();
    expect(screen.getByText('Workshop Bin')).toBeInTheDocument();
    expect(screen.getByText('Vase Mode')).toBeInTheDocument();
    expect(screen.getByText('Divider Grid')).toBeInTheDocument();
  });

  it('clicking Heavy Duty preset updates store to rugged style', () => {
    render(<PresetSelector />);

    fireEvent.click(screen.getByLabelText('Apply Heavy Duty preset'));

    const params = useDesignerStore.getState().params;
    expect(params.style).toBe('rugged');
    expect(params.base.style).toBe('magnet');
    expect(params.scoop).toBe(true);
  });

  it('clicking Quick Print preset sets lite style', () => {
    render(<PresetSelector />);

    fireEvent.click(screen.getByLabelText('Apply Quick Print preset'));

    const params = useDesignerStore.getState().params;
    expect(params.style).toBe('lite');
    expect(params.base.stackingLip).toBe(false);
    expect(params.height).toBe(3);
  });

  it('preset preserves dimensions that are not in overrides', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 4, depth: 5 },
    });

    render(<PresetSelector />);

    fireEvent.click(screen.getByLabelText('Apply Heavy Duty preset'));

    const params = useDesignerStore.getState().params;
    expect(params.width).toBe(4);
    expect(params.depth).toBe(5);
  });

  it('preset preserves inserts unless explicitly cleared', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [{ id: 'test', templateId: null, shape: 'circle', x: 0, y: 0, width: 10, depth: 10, cutDepth: 5, rotation: 0, cornerRadius: 0, label: 'Test' }],
      },
    });

    render(<PresetSelector />);

    // Heavy Duty doesn't override inserts
    fireEvent.click(screen.getByLabelText('Apply Heavy Duty preset'));
    expect(useDesignerStore.getState().params.inserts).toHaveLength(1);

    // Vase Mode clears inserts
    fireEvent.click(screen.getByLabelText('Apply Vase Mode preset'));
    expect(useDesignerStore.getState().params.inserts).toHaveLength(0);
  });

  it('applying preset adds to undo history', () => {
    render(<PresetSelector />);

    fireEvent.click(screen.getByLabelText('Apply Heavy Duty preset'));

    const history = useDesignerStore.getState().history;
    expect(history.past.length).toBeGreaterThan(0);
  });

  it('shows help text about what presets do', () => {
    render(<PresetSelector />);

    expect(screen.getByText(/Presets adjust style/)).toBeInTheDocument();
  });

  describe('user presets', () => {
    it('shows "Save as Preset" button when no user presets exist', () => {
      render(<PresetSelector />);
      expect(screen.getByLabelText('Save current settings as preset')).toBeInTheDocument();
    });

    it('clicking "Save as Preset" shows the save form', () => {
      render(<PresetSelector />);

      fireEvent.click(screen.getByLabelText('Save current settings as preset'));

      expect(screen.getByLabelText('Preset name')).toBeInTheDocument();
      expect(screen.getByLabelText('Preset description')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('cancel hides the save form', () => {
      render(<PresetSelector />);

      fireEvent.click(screen.getByLabelText('Save current settings as preset'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByLabelText('Preset name')).not.toBeInTheDocument();
    });

    it('saves a new user preset and shows it in the list', () => {
      render(<PresetSelector />);

      fireEvent.click(screen.getByLabelText('Save current settings as preset'));
      fireEvent.change(screen.getByLabelText('Preset name'), {
        target: { value: 'My Custom' },
      });
      fireEvent.change(screen.getByLabelText('Preset description'), {
        target: { value: 'A custom preset' },
      });
      fireEvent.click(screen.getByText('Save'));

      // Form is hidden
      expect(screen.queryByLabelText('Preset name')).not.toBeInTheDocument();
      // User preset section appears
      expect(screen.getByText('My Presets')).toBeInTheDocument();
      expect(screen.getByLabelText('Apply My Custom preset')).toBeInTheDocument();
    });

    it('saves preset to localStorage', () => {
      render(<PresetSelector />);

      fireEvent.click(screen.getByLabelText('Save current settings as preset'));
      fireEvent.change(screen.getByLabelText('Preset name'), {
        target: { value: 'Stored' },
      });
      fireEvent.click(screen.getByText('Save'));

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Stored');
    });

    it('does not save with empty name', () => {
      render(<PresetSelector />);

      fireEvent.click(screen.getByLabelText('Save current settings as preset'));
      fireEvent.change(screen.getByLabelText('Preset name'), {
        target: { value: '   ' },
      });
      fireEvent.click(screen.getByText('Save'));

      // Form remains visible since save was rejected
      expect(screen.getByLabelText('Preset name')).toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('clicking a user preset applies its overrides', () => {
      // Pre-seed a user preset in localStorage
      const preset = {
        id: 'user-1',
        name: 'Thick Walls',
        description: '',
        overrides: { style: 'rugged' as const, scoop: false },
        createdAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([preset]));

      render(<PresetSelector />);

      fireEvent.click(screen.getByLabelText('Apply Thick Walls preset'));

      const params = useDesignerStore.getState().params;
      expect(params.style).toBe('rugged');
      expect(params.scoop).toBe(false);
    });

    it('delete button removes user preset', () => {
      const preset = {
        id: 'user-del',
        name: 'To Delete',
        description: '',
        overrides: {},
        createdAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([preset]));

      render(<PresetSelector />);

      expect(screen.getByLabelText('Apply To Delete preset')).toBeInTheDocument();

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      fireEvent.click(screen.getByLabelText('Delete To Delete preset'));

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Delete "To Delete"'));
      expect(screen.queryByLabelText('Apply To Delete preset')).not.toBeInTheDocument();
      expect(loadStoredPresets()).toHaveLength(0);
    });

    it('hides "Save as Preset" button when MAX_USER_PRESETS reached', () => {
      // Seed localStorage with max presets
      const presets = Array.from({ length: 20 }, (_, i) => ({
        id: `preset-${i}`,
        name: `Preset ${i}`,
        description: '',
        overrides: {},
        createdAt: i,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));

      render(<PresetSelector />);

      expect(screen.queryByLabelText('Save current settings as preset')).not.toBeInTheDocument();
    });

    it('shows "My Presets" section with pre-existing presets', () => {
      const presets = [
        { id: 'p1', name: 'Alpha', description: '', overrides: {}, createdAt: 1 },
        { id: 'p2', name: 'Beta', description: '', overrides: {}, createdAt: 2 },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));

      render(<PresetSelector />);

      expect(screen.getByText('My Presets')).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
  });
});

function loadStoredPresets() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
}
