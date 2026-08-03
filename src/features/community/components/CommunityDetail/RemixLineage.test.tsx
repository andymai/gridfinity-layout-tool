// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CommunityDesignLineage } from '@/shared/types/community';
import { RemixLineage } from './RemixLineage';
import type { ParentResolution } from './CommunityDetailContent';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const PARENT_ID = 'ParentDes1gn';
const ROOT_ID = 'RootDesign12';

function lineage(overrides: Partial<CommunityDesignLineage> = {}): CommunityDesignLineage {
  return {
    parentId: PARENT_ID,
    rootId: PARENT_ID,
    parentName: 'Parent Bin',
    parentAuthorName: 'Jo',
    rootAuthorName: 'Jo',
    ...overrides,
  };
}

function setup(
  overrides: Partial<CommunityDesignLineage> = {},
  parentResolution: ParentResolution = { kind: 'snapshot' },
  onOpenDesign: ((id: string) => void) | undefined = vi.fn()
) {
  render(
    <RemixLineage
      lineage={lineage(overrides)}
      parentResolution={parentResolution}
      designName="My Remix"
      onOpenDesign={onOpenDesign}
    />
  );
  return onOpenDesign;
}

describe('RemixLineage', () => {
  it('shows the parent and the current design', () => {
    setup();

    expect(screen.getByTestId('remix-lineage-parent')).toHaveTextContent('Parent Bin');
    expect(screen.getByTestId('remix-lineage-current')).toHaveTextContent('My Remix');
  });

  it('omits the root step when the parent is the root', () => {
    setup();
    expect(screen.queryByTestId('remix-lineage-root')).toBeNull();
  });

  it('shows a separate root step when the chain is longer', () => {
    setup({ rootId: ROOT_ID, rootAuthorName: 'Sam' });
    // The echo mock returns keys, so assert the key rather than the copy.
    expect(screen.getByTestId('remix-lineage-root')).toHaveTextContent('community.lineage.root');
  });

  it('admits that intermediate steps are unrecorded', () => {
    setup({ rootId: ROOT_ID, rootAuthorName: 'Sam' });
    // Only parentId and rootId are stored, so a continuous chain would imply
    // completeness the data does not have.
    expect(screen.getByTestId('remix-lineage-gap')).toBeInTheDocument();
  });

  it('does not claim a gap when there is none to claim', () => {
    setup();
    expect(screen.queryByTestId('remix-lineage-gap')).toBeNull();
  });

  it('opens the parent when it is still available', () => {
    const onOpen = setup();
    fireEvent.click(screen.getByLabelText('community.lineage.openParent'));
    expect(onOpen).toHaveBeenCalledWith(PARENT_ID);
  });

  it('opens the root when there is one', () => {
    const onOpen = setup({ rootId: ROOT_ID, rootAuthorName: 'Sam' });
    fireEvent.click(screen.getByLabelText('community.lineage.openRoot'));
    expect(onOpen).toHaveBeenCalledWith(ROOT_ID);
  });

  it('labels a gone parent and refuses to link it', () => {
    setup({}, { kind: 'gone' });

    const parent = screen.getByTestId('remix-lineage-parent');
    expect(parent).toHaveTextContent('community.lineage.unavailable');
    // A dead link is worse than a plainly labelled dead end.
    expect(screen.queryByLabelText('community.lineage.openParent')).toBeNull();
  });

  it('prefers the live parent name over the publish-time snapshot', () => {
    setup({}, { kind: 'live', name: 'Renamed Bin', authorName: 'Jo' });
    expect(screen.getByTestId('remix-lineage-parent')).toHaveTextContent('Renamed Bin');
  });

  it('renders read-only with no navigation handler', () => {
    render(
      <RemixLineage
        lineage={lineage({ rootId: ROOT_ID })}
        parentResolution={{ kind: 'snapshot' }}
        designName="My Remix"
      />
    );
    expect(screen.queryByLabelText('community.lineage.openParent')).toBeNull();
    expect(screen.getByTestId('remix-lineage-parent')).toHaveTextContent('Parent Bin');
  });
});
