import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BinFeaturesSection } from './BinFeaturesSection';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';

const LIP = 'Stacking lip';

function setParams(overrides: Partial<typeof DEFAULT_BIN_PARAMS> = {}) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, ...overrides },
    history: { past: [], future: [] },
  });
}

const lipSwitch = () => screen.getByRole('switch', { name: LIP });

describe('BinFeaturesSection', () => {
  beforeEach(() => {
    setParams();
  });

  it('reflects the stacking lip currently on the bin', () => {
    setParams({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } });
    render(<BinFeaturesSection />);

    expect(lipSwitch()).toHaveAttribute('aria-checked', 'true');
  });

  it('clears the stacking lip without leaving the cutout editor', () => {
    setParams({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } });
    render(<BinFeaturesSection />);

    fireEvent.click(lipSwitch());

    expect(useDesignerStore.getState().params.base.stackingLip).toBe(false);
    expect(lipSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('puts the stacking lip back', () => {
    setParams({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } });
    render(<BinFeaturesSection />);

    fireEvent.click(lipSwitch());

    expect(useDesignerStore.getState().params.base.stackingLip).toBe(true);
  });

  // The workspace's Ctrl+Z and undo button read the designer history stack, so a
  // toggle that skipped it would be the one edit in the editor you can't take
  // back.
  it('records the toggle on the undo stack', () => {
    setParams({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } });
    render(<BinFeaturesSection />);

    fireEvent.click(lipSwitch());
    useDesignerStore.getState().undo();

    expect(useDesignerStore.getState().params.base.stackingLip).toBe(true);
  });

  // Clearing the lip stops the lid generating while `lid.enabled` stays true.
  // The Lid section carries that warning in the main panel, which is off screen
  // here, so without this the lid would vanish unexplained.
  it('warns that an enabled lid is paused once the lip is off', () => {
    setParams({
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
    });
    render(<BinFeaturesSection />);

    expect(screen.getByText(/lid needs the stacking lip/i)).toBeInTheDocument();
  });

  it('stays quiet about the lid while the lip is on', () => {
    setParams({
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
    });
    render(<BinFeaturesSection />);

    expect(screen.queryByText(/lid needs the stacking lip/i)).not.toBeInTheDocument();
  });

  it('stays quiet when there is no lid to pause', () => {
    setParams({
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: false },
    });
    render(<BinFeaturesSection />);

    expect(screen.queryByText(/lid needs the stacking lip/i)).not.toBeInTheDocument();
  });
});
