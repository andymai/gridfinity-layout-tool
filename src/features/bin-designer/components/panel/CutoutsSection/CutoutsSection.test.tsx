import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { CutoutsSection } from './CutoutsSection';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, unknown>) => {
    if (vars && 'count' in vars) return `${vars.count} ${key}`;
    return key;
  },
}));

vi.mock('./CutoutEditor', () => ({
  CutoutEditor: () => <div data-testid="cutout-editor" />,
}));

describe('CutoutsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('renders instructions and editor', () => {
    render(<CutoutsSection />);
    expect(screen.getByText('binDesigner.cutouts.instructions')).toBeInTheDocument();
    expect(screen.getByTestId('cutout-editor')).toBeInTheDocument();
  });

  it('shows clear button when cutouts exist', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          {
            id: 'c1',
            shape: 'rectangle',
            x: 0,
            y: 0,
            width: 10,
            depth: 10,
            cutDepth: 5,
            rotation: 0,
            cornerRadius: 0,
            label: '',
            groupId: null,
          },
        ],
      },
    });

    render(<CutoutsSection />);
    expect(screen.getByText('binDesigner.cutouts.clearAll')).toBeInTheDocument();
  });

  it('does not show clear button when no cutouts', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [],
      },
    });

    render(<CutoutsSection />);
    expect(screen.queryByText('binDesigner.cutouts.clearAll')).not.toBeInTheDocument();
  });

  it('opens confirm dialog on clear button click', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          {
            id: 'c1',
            shape: 'rectangle',
            x: 0,
            y: 0,
            width: 10,
            depth: 10,
            cutDepth: 5,
            rotation: 0,
            cornerRadius: 0,
            label: '',
            groupId: null,
          },
        ],
      },
    });

    render(<CutoutsSection />);
    fireEvent.click(screen.getByText('binDesigner.cutouts.clearAll'));

    // Confirm dialog should appear
    expect(screen.getByText('binDesigner.cutouts.clearAllConfirmTitle')).toBeInTheDocument();
  });

  it('clears cutouts when confirm dialog is confirmed', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          {
            id: 'c1',
            shape: 'rectangle',
            x: 0,
            y: 0,
            width: 10,
            depth: 10,
            cutDepth: 5,
            rotation: 0,
            cornerRadius: 0,
            label: '',
            groupId: null,
          },
        ],
      },
    });

    render(<CutoutsSection />);
    fireEvent.click(screen.getByText('binDesigner.cutouts.clearAll'));

    // Click the confirm button in the dialog (the one with btn-danger class)
    const dialog = screen.getByRole('dialog');
    const confirmBtn = dialog.querySelector('button.btn-danger');
    expect(confirmBtn).not.toBeNull();
    fireEvent.click(confirmBtn!);

    const { params } = useDesignerStore.getState();
    expect(params.cutouts).toEqual([]);
  });
});
