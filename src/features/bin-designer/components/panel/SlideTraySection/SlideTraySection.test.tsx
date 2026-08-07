import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { SlideTraySection } from './SlideTraySection';

function setParams(over: Partial<typeof DEFAULT_BIN_PARAMS>): void {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2, height: 6, ...over },
  });
}

beforeEach(() => setParams({}));

describe('SlideTraySection', () => {
  it('renders the feature toggle', () => {
    render(<SlideTraySection />);
    expect(screen.getByText('Sliding tray')).toBeInTheDocument();
  });

  it('shows the mount picker and its hint once enabled', () => {
    setParams({ slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true } });
    render(<SlideTraySection />);
    expect(screen.getByLabelText('Rail position')).toBeInTheDocument();
    // The hint is the only thing telling a user the two mounts differ in
    // whether the tray can leave the bin at all.
    expect(screen.getByText(/slides within it/i)).toBeInTheDocument();
  });

  it('switches the hint with the mount', () => {
    setParams({ slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true, railMount: 'rim' } });
    render(<SlideTraySection />);
    expect(screen.getByText(/neighbouring bin/i)).toBeInTheDocument();
  });

  it('warns when the tray would stand proud of the rim', () => {
    setParams({ slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true, railDropMm: 0 } });
    render(<SlideTraySection />);
    expect(screen.getByText(/above the rim/i)).toBeInTheDocument();
  });

  it('explains an unusable bin instead of offering a dead toggle', () => {
    setParams({ style: 'slotted' });
    render(<SlideTraySection />);
    expect(screen.getByText(/divider slots/i)).toBeInTheDocument();
  });
});
