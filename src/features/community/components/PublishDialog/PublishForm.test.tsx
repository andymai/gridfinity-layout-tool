import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '@/design-system';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesignLineage } from '@/shared/types/community';
import { PublishForm } from './PublishForm';
import type { PublishFormProps } from './PublishForm';

vi.mock('../../api/printsClient', () => ({
  fetchPrints: vi.fn(() => new Promise(() => undefined)),
  setCoverPhoto: vi.fn(),
}));

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
    publicName: 'andy',
    firstTimePublisher: false,
    signedIn: true,
    requireCutouts: false,
    printsEnabled: false,
    publishedId: null,
    currentCoverUrl: '',
    error: null,
    onPublicNameChange: vi.fn(),
    onSubmit: vi.fn(),
    onSignIn: vi.fn(),
    onRetryCapture: vi.fn(),
    onDropRemix: vi.fn(),
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

  it('explains why the primary is disabled while the preview is pending', () => {
    renderForm({ captures: null });
    expect(screen.getByText('Waiting for the preview…')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toHaveAttribute(
      'aria-describedby',
      'community-publish-blocked'
    );
  });

  it('shows the capture-fault state with retry when a capture attempt failed', () => {
    const props = renderForm({ captures: null, captureFailed: true });
    expect(screen.getByText("Couldn't capture the preview.")).toBeInTheDocument();
    expect(screen.queryByText('Preparing preview…')).not.toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeDisabled();
    fireEvent.click(screen.getByText('Retry preview'));
    expect(props.onRetryCapture).toHaveBeenCalledTimes(1);
  });

  it('shows one large preview with the remaining angles as a strip', () => {
    renderForm();
    expect(screen.getAllByAltText(/Design preview/)).toHaveLength(1);
    expect(screen.getByLabelText('Show angle 2')).toBeInTheDocument();
  });

  it('swaps the large preview when another angle is chosen', () => {
    renderForm();
    expect(screen.getByAltText('Design preview 1')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Show angle 2'));
    expect(screen.getByAltText('Design preview 2')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('radio', { name: 'Hardware' }));
    fireEvent.click(screen.getByText('Publish'));
    expect(props.onSubmit).toHaveBeenCalledWith({
      name: 'Screw Bin',
      description: 'tips',
      category: 'hardware',
      publicName: 'andy',
    });
  });

  it('routes a server name rejection to the name field rather than replacing the form', () => {
    renderForm({ error: { kind: 'validation', code: 'NAME_LOW_EFFORT', message: 'nope' } });
    expect(screen.getByText('Give your design a real, descriptive name.')).toBeInTheDocument();
    // The form is still there: the user can see and fix what they typed.
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('drops the field rejection once the user starts fixing that field', () => {
    renderForm({ error: { kind: 'validation', code: 'NAME_LOW_EFFORT', message: 'nope' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Hex bit holder' } });
    expect(
      screen.queryByText('Give your design a real, descriptive name.')
    ).not.toBeInTheDocument();
  });

  it('keeps a field rejection while an unrelated field is edited', () => {
    renderForm({ error: { kind: 'validation', code: 'NAME_LOW_EFFORT', message: 'nope' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'notes' } });
    expect(screen.getByText('Give your design a real, descriptive name.')).toBeInTheDocument();
  });

  it('renders a non-field failure as a banner over the intact form', () => {
    renderForm({ error: { kind: 'rateLimited', retryAfterSeconds: null } });
    expect(screen.getByText('Too many publishes right now. Try again later.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
  });

  it('offers dropping the remix link when the server rejects the lineage', () => {
    const props = renderForm({
      error: { kind: 'validation', code: 'INVALID_LINEAGE', message: 'bad' },
    });
    fireEvent.click(screen.getByText('Publish without the remix link'));
    expect(props.onDropRemix).toHaveBeenCalledTimes(1);
  });

  it('states the cutout policy and blocks submit instead of leaving a dead button', () => {
    renderForm({ requireCutouts: true });
    expect(screen.getByText('This design needs a tool cutout')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeDisabled();
  });

  it('defers sign-in until the fields validate', () => {
    const props = renderForm({
      signedIn: false,
      prefill: { name: '', description: '', category: null },
    });
    fireEvent.click(screen.getByText('Sign in & publish'));
    // Invalid fields must not cost an OAuth round trip.
    expect(screen.queryByText('Sign in to finish publishing')).not.toBeInTheDocument();
    expect(props.onSignIn).not.toHaveBeenCalled();
  });

  it('prompts for a provider once a signed-out form is valid', () => {
    const props = renderForm({ signedIn: false });
    fireEvent.click(screen.getByRole('radio', { name: 'Tools' }));
    fireEvent.click(screen.getByText('Sign in & publish'));
    expect(screen.getByText('Sign in to finish publishing')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sign in with Google'));
    expect(props.onSignIn).toHaveBeenCalledWith('google', {
      name: 'Screw Bin',
      description: '',
      category: 'tools',
      publicName: 'andy',
    });
    expect(props.onSubmit).not.toHaveBeenCalled();
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

  it('collapses the public name once one is saved and reopens it on request', () => {
    const props = renderForm();
    expect(screen.getByText('Publishing as')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Change'));
    fireEvent.change(screen.getByLabelText(/Public name/), { target: { value: 'ada' } });
    expect(props.onPublicNameChange).toHaveBeenCalledWith('ada');
  });

  it('opens the public name field expanded for a first-time publisher', () => {
    renderForm({ firstTimePublisher: true, publicName: '' });
    expect(screen.getByLabelText(/Public name/)).toBeInTheDocument();
    expect(screen.queryByText('Publishing as')).not.toBeInTheDocument();
  });

  it('update mode renders Update and keeps Unpublish out of the primary footer', () => {
    const onUnpublish = vi.fn();
    renderForm({ mode: 'update', onUnpublish });
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Remove from the showcase')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Unpublish'));
    expect(onUnpublish).toHaveBeenCalledTimes(1);
  });

  it('offers the cover-image path only for a published design with prints enabled', () => {
    renderForm({ mode: 'update', publishedId: 'Design123456', printsEnabled: true });
    expect(screen.getByText('Checking your print photos…')).toBeInTheDocument();
  });

  it('omits the cover section while prints are switched off', () => {
    renderForm({ mode: 'update', publishedId: 'Design123456', printsEnabled: false });
    expect(screen.queryByText('Checking your print photos…')).not.toBeInTheDocument();
  });
});
