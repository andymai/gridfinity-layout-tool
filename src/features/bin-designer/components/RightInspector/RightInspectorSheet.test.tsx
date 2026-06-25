import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RightInspectorSheet } from './RightInspectorSheet';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('RightInspectorSheet', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'standard' },
      itemKind: 'bin',
      ui: {
        ...useDesignerStore.getState().ui,
        cutoutEditorOpen: false,
        selectedCompartmentId: null,
        selectedColorZone: null,
        selectedDividerKey: null,
      },
    });
  });

  it('renders nothing in cutout mode', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, cutoutEditorOpen: true },
    });
    const { container } = render(<RightInspectorSheet />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a trigger (sheet closed) for a standard bin', () => {
    render(<RightInspectorSheet />);
    // The FAB trigger is present; the sheet body is not mounted until opened.
    expect(screen.getByText('Inspector')).toBeInTheDocument();
  });
});
