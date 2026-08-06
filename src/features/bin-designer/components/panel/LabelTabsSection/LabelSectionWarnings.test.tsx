import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LabelSectionWarnings } from './LabelSectionWarnings';
import type { LabelWarning } from './useLabelTabsSection';

const GROUP_TITLES = { placement: 'Placement', shape: 'Tab shape' } as const;

const warning = (over: Partial<LabelWarning> = {}): LabelWarning => ({
  id: 'edges-collision',
  group: 'placement',
  message: 'Front tabs will collide.',
  fixLabel: 'Auto-fix',
  onFix: vi.fn(),
  ...over,
});

describe('LabelSectionWarnings', () => {
  it('surfaces a warning whose group is collapsed', () => {
    render(
      <LabelSectionWarnings
        warnings={[warning()]}
        expandedGroups={new Set()}
        onJumpToGroup={vi.fn()}
        groupTitles={GROUP_TITLES}
      />
    );
    // Progressive disclosure defers options, never an active problem.
    expect(screen.getByText('Front tabs will collide.')).toBeInTheDocument();
  });

  it('stays silent when the owning group is expanded', () => {
    const { container } = render(
      <LabelSectionWarnings
        warnings={[warning()]}
        expandedGroups={new Set(['placement'])}
        onJumpToGroup={vi.fn()}
        groupTitles={GROUP_TITLES}
      />
    );
    // The group renders its own copy in context; two would say it twice.
    expect(container).toBeEmptyDOMElement();
  });

  it('carries the fix along with the diagnosis', () => {
    const onFix = vi.fn();
    render(
      <LabelSectionWarnings
        warnings={[warning({ onFix })]}
        expandedGroups={new Set()}
        onJumpToGroup={vi.fn()}
        groupTitles={GROUP_TITLES}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Auto-fix' }));
    expect(onFix).toHaveBeenCalled();
  });

  it('links back to the group that owns the control', () => {
    const onJumpToGroup = vi.fn();
    render(
      <LabelSectionWarnings
        warnings={[warning()]}
        expandedGroups={new Set()}
        onJumpToGroup={onJumpToGroup}
        groupTitles={GROUP_TITLES}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Placement' }));
    expect(onJumpToGroup).toHaveBeenCalledWith('placement');
  });

  it('shows only the collapsed groups when several warnings are active', () => {
    render(
      <LabelSectionWarnings
        warnings={[warning(), warning({ id: 'lip', group: 'shape', message: 'Lip too tall.' })]}
        expandedGroups={new Set(['placement'])}
        onJumpToGroup={vi.fn()}
        groupTitles={GROUP_TITLES}
      />
    );
    expect(screen.queryByText('Front tabs will collide.')).not.toBeInTheDocument();
    expect(screen.getByText('Lip too tall.')).toBeInTheDocument();
  });
});
