import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesignerUpdatedDialog } from './DesignerUpdatedDialog';
import { useLinkingStore } from '../../../store';

// Mock useBinLinking
const mockEditLinkedDesign = vi.fn();
vi.mock('../../../hooks', () => ({
  useBinLinking: () => ({
    editLinkedDesign: mockEditLinkedDesign,
  }),
}));

describe('DesignerUpdatedDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLinkingStore.setState({ pendingDesignerUpdated: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when pendingDesignerUpdated is null', () => {
    render(<DesignerUpdatedDialog />);
    expect(screen.queryByText('Designer Updated')).not.toBeInTheDocument();
  });

  it('renders dialog when pendingDesignerUpdated is set', () => {
    useLinkingStore.setState({
      pendingDesignerUpdated: {
        designId: 'design-1',
        designName: 'My Custom Bin',
      },
    });

    render(<DesignerUpdatedDialog />);
    expect(screen.getByText('Designer Updated')).toBeInTheDocument();
    expect(screen.getByText(/My Custom Bin/)).toBeInTheDocument();
  });

  it('hides dialog on dismiss', () => {
    useLinkingStore.setState({
      pendingDesignerUpdated: {
        designId: 'design-1',
        designName: 'My Custom Bin',
      },
    });

    render(<DesignerUpdatedDialog />);
    fireEvent.click(screen.getByText('Dismiss'));

    expect(useLinkingStore.getState().pendingDesignerUpdated).toBeNull();
  });

  it('navigates to designer on "Edit Design" click', () => {
    useLinkingStore.setState({
      pendingDesignerUpdated: {
        designId: 'design-1',
        designName: 'My Custom Bin',
      },
    });

    render(<DesignerUpdatedDialog />);
    fireEvent.click(screen.getByText('Edit Design'));

    expect(mockEditLinkedDesign).toHaveBeenCalledWith('design-1');
    expect(useLinkingStore.getState().pendingDesignerUpdated).toBeNull();
  });

  it('includes design name in description', () => {
    useLinkingStore.setState({
      pendingDesignerUpdated: {
        designId: 'design-1',
        designName: 'Screwdriver Holder',
      },
    });

    render(<DesignerUpdatedDialog />);
    expect(screen.getByText(/Screwdriver Holder/)).toBeInTheDocument();
  });
});
