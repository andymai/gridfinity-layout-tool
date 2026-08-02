import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '@/design-system';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesignLineage } from '@/shared/types/community';
import { PublishForm } from './PublishForm';
import type { PublishFormProps } from './PublishForm';

const params = {
  compartments: { cells: [0, 0] },
  walls: { enabled: false },
  scoop: { enabled: true },
  label: { enabled: false },
  style: 'standard',
  lid: { enabled: false },
  handles: { enabled: false },
  cellMask: undefined,
  wallPattern: { enabled: false },
} as unknown as BinParams;

const captures = {
  thumbnails: ['data:image/webp;base64,AA==', 'QUJD'],
  glb: 'Z2xURg==',
};

const lineage: CommunityDesignLineage = {
  parentId: 'Parent123456',
  rootId: 'Root12345678',
  parentName: 'Parent Bin',
  parentAuthorName: 'Alice',
  rootAuthorName: 'Bob',
};

function renderForm(overrides: Partial<PublishFormProps> = {}) {
  const props: PublishFormProps = {
    mode: 'create',
    prefill: { name: 'Screw Bin', description: '', category: null },
    captures,
    captureFailed: false,
    params,
    lineage: null,
    onSubmit: vi.fn(),
    onRetryCapture: vi.fn(),
    onUnpublish: null,
    ...overrides,
  };
  render(
    <Dialog.Root open onClose={() => undefined}>
      <PublishForm {...props} />
    </Dialog.Root>
  );
  return props;
}

describe('PublishForm', () => {
  it('shows the preparing state without a retry button while a capture is pending', () => {
    renderForm({ captures: null });
    expect(screen.getByText('Preparing preview…')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeDisabled();
    expect(screen.queryByText('Retry preview')).not.toBeInTheDocument();
  });

  it('shows the capture-fault state with retry when a capture attempt failed', () => {
    const props = renderForm({ captures: null, captureFailed: true });
    expect(screen.getByText("Couldn't capture the preview.")).toBeInTheDocument();
    expect(screen.queryByText('Preparing preview…')).not.toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeDisabled();
    fireEvent.click(screen.getByText('Retry preview'));
    expect(props.onRetryCapture).toHaveBeenCalledTimes(1);
  });

  it('renders one preview image per capture', () => {
    renderForm();
    expect(screen.getAllByAltText(/Design preview/)).toHaveLength(2);
  });

  it('blocks submit with inline errors when name and category are missing', () => {
    const props = renderForm({ prefill: { name: '', description: '', category: null } });
    fireEvent.click(screen.getByText('Publish'));
    expect(screen.getByText('Enter a name for this design.')).toBeInTheDocument();
    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed fields once name and category are set', () => {
    const props = renderForm({
      prefill: { name: '  Screw Bin  ', description: ' tips ', category: null },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'hardware' },
    });
    fireEvent.click(screen.getByText('Publish'));
    expect(props.onSubmit).toHaveBeenCalledWith({
      name: 'Screw Bin',
      description: 'tips',
      category: 'hardware',
    });
  });

  it('shows detected technique chips derived from the params', () => {
    renderForm();
    expect(screen.getByText('Scoop')).toBeInTheDocument();
  });

  it('shows the lineage notice when lineage is present', () => {
    renderForm({ lineage });
    expect(
      screen.getByText('Will be credited as a remix of Parent Bin by Alice')
    ).toBeInTheDocument();
    expect(screen.getByText('Originally by Bob')).toBeInTheDocument();
  });

  it('update mode renders Update and Unpublish actions', () => {
    const onUnpublish = vi.fn();
    renderForm({ mode: 'update', onUnpublish });
    expect(screen.getByText('Update')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Unpublish'));
    expect(onUnpublish).toHaveBeenCalledTimes(1);
  });
});
