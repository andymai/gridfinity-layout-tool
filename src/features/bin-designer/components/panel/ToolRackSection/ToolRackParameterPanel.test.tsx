import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolRackParameterPanel } from './ToolRackParameterPanel';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_TOOL_RACK_STRUCTURE } from '@/shared/items/toolRack/descriptor';
import { createDefaultEnvelope } from '@/shared/items/defaultEnvelope';
import type { ItemEnvelope } from '@/shared/types/item';

const envelope: ItemEnvelope = createDefaultEnvelope({ enabled: false } as never);

function setRackState(): void {
  useDesignerStore.setState({
    itemKind: 'toolRack',
    envelope,
    structure: {
      ...DEFAULT_TOOL_RACK_STRUCTURE,
      backRail: { ...DEFAULT_TOOL_RACK_STRUCTURE.backRail },
    },
    ui: { ...DEFAULT_UI_STATE },
  });
}

describe('ToolRackParameterPanel', () => {
  beforeEach(setRackState);

  it('renders the rack controls', () => {
    render(<ToolRackParameterPanel />);
    expect(screen.getByText('Fin angle (°)')).toBeInTheDocument();
    expect(screen.getByText('Fins')).toBeInTheDocument();
    expect(screen.getByText('Width (u)')).toBeInTheDocument();
    expect(screen.getByText('Magnet holes')).toBeInTheDocument();
    expect(screen.getByText('Export STL')).toBeInTheDocument();
  });

  it('toggling the back rail updates the structure', () => {
    render(<ToolRackParameterPanel />);
    const railToggle = screen.getByRole('switch', { name: 'Back rail' });
    railToggle.click();
    const structure = useDesignerStore.getState().structure;
    expect(structure?.kind).toBe('toolRack');
    if (structure?.kind === 'toolRack') {
      expect(structure.backRail.enabled).toBe(false);
    }
  });

  it('renders nothing for a bin design', () => {
    useDesignerStore.setState({ itemKind: 'bin', envelope: null, structure: null });
    const { container } = render(<ToolRackParameterPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
