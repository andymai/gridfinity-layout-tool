import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InspectorPanel } from './InspectorPanel';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('InspectorPanel', () => {
  it('renders no selection message when selection is empty', () => {
    render(
      <InspectorPanel
        cutouts={[]}
        selection={new Set()}
        binWidth={40}
        binDepth={40}
        maxCutDepth={10}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onDuplicate={vi.fn()}
        onGroup={vi.fn()}
        onUngroup={vi.fn()}
        onClearAll={vi.fn()}
      />
    );

    expect(screen.getByText('binDesigner.cutoutEditor.noSelection')).toBeInTheDocument();
  });

  it('renders transform section for single selection', () => {
    const cutouts = [
      {
        id: 'c1',
        shape: 'rectangle' as const,
        x: 5,
        y: 5,
        width: 10,
        depth: 10,
        cutDepth: 5,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
      },
    ];

    render(
      <InspectorPanel
        cutouts={cutouts}
        selection={new Set(['c1'])}
        binWidth={40}
        binDepth={40}
        maxCutDepth={10}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onDuplicate={vi.fn()}
        onGroup={vi.fn()}
        onUngroup={vi.fn()}
        onClearAll={vi.fn()}
      />
    );

    expect(screen.getByText('binDesigner.cutoutEditor.transform')).toBeInTheDocument();
  });
});
