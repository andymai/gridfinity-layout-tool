import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorsSection } from './ColorsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('ColorsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        featureColors: { body: '#3b82f6', lip: '#ef4444', labelTab: '#22c55e' },
      },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders body, lip, and label tab zone rows', () => {
    render(<ColorsSection />);
    expect(screen.getByText('Body')).toBeDefined();
    expect(screen.getByText('Stacking Lip')).toBeDefined();
    expect(screen.getByText('Label Tab')).toBeDefined();
  });

  it('hides lip row when stacking lip is off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        featureColors: { body: '#3b82f6', lip: '#3b82f6', labelTab: '#3b82f6' },
      },
    });

    render(<ColorsSection />);
    expect(screen.queryByText('Stacking Lip')).toBeNull();
  });

  it('hides label tab row when labels are off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
        featureColors: { body: '#3b82f6', lip: '#3b82f6', labelTab: '#3b82f6' },
      },
    });

    render(<ColorsSection />);
    expect(screen.queryByText('Label Tab')).toBeNull();
  });

  it('always shows body row', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
        featureColors: { body: '#3b82f6', lip: '#3b82f6', labelTab: '#3b82f6' },
      },
    });

    render(<ColorsSection />);
    expect(screen.getByText('Body')).toBeDefined();
  });

  describe('"Used in this design" cross-zone filtering', () => {
    it('offers the OTHER active zones as match shortcuts in the body picker', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
          featureColors: { body: '#3b82f6', lip: '#ef4444', labelTab: '#22c55e' },
        },
      });
      render(<ColorsSection />);
      fireEvent.click(screen.getByRole('button', { name: /Body/ }));
      expect(screen.getByTitle('#ef4444')).toBeInTheDocument();
      expect(screen.getByTitle('#22c55e')).toBeInTheDocument();
    });

    it('excludes the current zone color from its own suggestions', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
          featureColors: { body: '#3b82f6', lip: '#ef4444', labelTab: '#22c55e' },
        },
      });
      render(<ColorsSection />);
      fireEvent.click(screen.getByRole('button', { name: /Body/ }));
      // The body color itself must not appear in its own quick-match row.
      expect(screen.queryByTitle('#3b82f6')).not.toBeInTheDocument();
    });

    it('case-insensitively dedupes equal colors across zones', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
          // Lip and labelTab share the same hex with different casing —
          // exactly one entry must appear in the suggestions.
          featureColors: { body: '#3b82f6', lip: '#EF4444', labelTab: '#ef4444' },
        },
      });
      render(<ColorsSection />);
      fireEvent.click(screen.getByRole('button', { name: /Body/ }));
      const matches = screen.queryAllByTitle(/^#ef4444$/i);
      expect(matches).toHaveLength(1);
    });

    it('skips hidden zones (stacking lip / labels off) from the suggestion source', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false }, // lip hidden
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: false }, // label hidden
          featureColors: { body: '#3b82f6', lip: '#ef4444', labelTab: '#22c55e' },
        },
      });
      render(<ColorsSection />);
      fireEvent.click(screen.getByRole('button', { name: /Body/ }));
      // Hidden zones' colors must not surface as shortcuts.
      expect(screen.queryByTitle('#ef4444')).not.toBeInTheDocument();
      expect(screen.queryByTitle('#22c55e')).not.toBeInTheDocument();
    });
  });
});
