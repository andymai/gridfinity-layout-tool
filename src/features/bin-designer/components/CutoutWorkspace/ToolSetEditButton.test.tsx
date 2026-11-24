import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { ToolSetEditButton } from './ToolSetEditButton';

describe('ToolSetEditButton', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().setParams({
      cutoutToolSets: {
        g1: {
          family: 'combinationWrench',
          units: 'metric',
          sizes: ['13'],
          style: 'flat',
          clearanceMm: 0.4,
          labelSizeMm: 5,
          fingerChannel: true,
        },
      },
    });
  });

  it('opens the set dialog for a selected tool set', () => {
    render(<ToolSetEditButton groupId="g1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit set' }));
    expect(useDesignerStore.getState().ui.toolSetDialog).toEqual({ setId: 'g1' });
  });

  it('renders nothing for a group that is not a tool set', () => {
    const { container } = render(<ToolSetEditButton groupId="other" />);
    expect(container).toBeEmptyDOMElement();
  });
});
