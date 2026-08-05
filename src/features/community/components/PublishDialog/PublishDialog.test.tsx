import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import {
  INITIAL_COMMUNITY_PUBLISH_STATE,
  useCommunityPublishStore,
} from '@/core/store/communityPublish';
import type {
  CommunityPublishDesignContext,
  CommunityPublishHandlers,
} from '@/core/store/communityPublish';
import { useSessionStore } from '@/core/sync/session/useSession';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesign } from '@/shared/types/community';
import { hashBinParams } from '@/shared/utils/binParamsHash';
import { loadPendingPublishAction } from '@/shared/utils/communityPendingAction';
import { INITIAL_PUBLISH_DIALOG_STATE, usePublishDialogStore } from '../../store/publishStore';
import { saveDisplayName } from '../../utils/displayName';
import {
  fetchCommunityCapabilities,
  fetchOwnDesign,
  publishDesign,
  unpublishDesign,
  updateDesign,
} from '../../api/client';
import { PublishDialog } from './PublishDialog';

vi.mock('../../api/client', () => ({
  publishDesign: vi.fn(),
  updateDesign: vi.fn(),
  unpublishDesign: vi.fn(),
  fetchOwnDesign: vi.fn(),
  fetchCommunityCapabilities: vi.fn(),
}));

vi.mock('../../api/printsClient', () => ({
  fetchPrints: vi.fn(() => new Promise(() => undefined)),
  setCoverPhoto: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/core/sync/session/sessionApi', () => ({
  getMe: vi.fn(),
  signInUrl: (provider: string) => `https://example.test/auth/${provider}`,
}));

import { trackEvent } from '@/shared/analytics/posthog';
import { getMe } from '@/core/sync/session/sessionApi';
import type { SessionUser } from '@/core/sync/session/sessionApi';

const LIVE_USER: SessionUser = { userId: 'u1', provider: 'google', email: 'a@b.c' };

const params = {
  compartments: { cells: [0] },
  walls: { enabled: false },
  scoop: { enabled: false },
  label: { enabled: false },
  style: 'standard',
  lid: { enabled: false },
  handles: { enabled: false },
  cellMask: undefined,
  wallPattern: { enabled: false },
} as unknown as BinParams;

const captures = { thumbnails: ['data:image/webp;base64,AA=='], glb: 'Z2xURg==' };

function signIn(user: SessionUser = LIVE_USER) {
  useSessionStore.setState({ status: 'authenticated', user });
}

function makeContext(
  overrides: Partial<CommunityPublishDesignContext> = {}
): CommunityPublishDesignContext {
  return {
    designId: 'design-1',
    designName: 'Screw Bin',
    params,
    paramsHash: hashBinParams(params),
    publishedId: null,
    lineage: null,
    draft: null,
    ...overrides,
  };
}

function makeHandlers(): CommunityPublishHandlers {
  return {
    onPublished: vi.fn().mockResolvedValue(true),
    onUnpublished: vi.fn(),
    requestRecapture: vi.fn(),
  };
}

function publishedRecord(overrides: Partial<CommunityDesign> = {}): CommunityDesign {
  return {
    id: 'Pub123456789',
    authorPublicId: 'author-public',
    authorName: 'Andy',
    name: 'Published Name',
    description: 'Published description',
    category: 'hardware',
    techniques: [],
    params,
    metrics: { width: 2, depth: 2, height: 6, gridUnitMm: 42 },
    lineage: null,
    thumbnails: [],
    meshUrl: '',
    photos: [],
    featured: false,
    createdAt: 1,
    updatedAt: 1,
    status: 'live',
    ...overrides,
  };
}

function openDialog(
  context: CommunityPublishDesignContext,
  handlers: CommunityPublishHandlers = makeHandlers(),
  withCaptures = true
) {
  useCommunityPublishStore.getState().open(context, withCaptures ? captures : undefined, handlers);
  render(<PublishDialog />);
  return handlers;
}

async function fillAndSubmit(label = 'Publish') {
  fireEvent.click(await screen.findByRole('radio', { name: 'Tools' }));
  fireEvent.click(screen.getByText(label));
}

describe('PublishDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useCommunityPublishStore.setState(INITIAL_COMMUNITY_PUBLISH_STATE);
    usePublishDialogStore.setState(INITIAL_PUBLISH_DIALOG_STATE);
    useSessionStore.setState({ status: 'anonymous', user: null });
    // Default: a 404 reconcile confirms a live session, so the prefill clears.
    vi.mocked(getMe).mockResolvedValue(LIVE_USER);
    vi.mocked(fetchCommunityCapabilities).mockResolvedValue(
      ok({ publishEnabled: true, printsEnabled: false, requireCutouts: false })
    );
  });

  it('states up front when publishing is switched off server-side', async () => {
    // The kill switch has no client-side shadow, so without the probe this only
    // surfaced as a 503 after a completed form was submitted.
    signIn();
    vi.mocked(fetchCommunityCapabilities).mockResolvedValue(
      ok({ publishEnabled: false, printsEnabled: false, requireCutouts: false })
    );
    openDialog(makeContext());
    expect(await screen.findByText('Publishing is switched off')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Name/)).not.toBeInTheDocument();
    expect(publishDesign).not.toHaveBeenCalled();
  });

  it('shows the form anyway when the probe itself cannot reach the server', async () => {
    signIn();
    saveDisplayName('Andy');
    vi.mocked(fetchCommunityCapabilities).mockResolvedValue(err({ kind: 'network' }));
    openDialog(makeContext());
    expect(await screen.findByText('Publish')).toBeInTheDocument();
  });

  it('signed out: shows the whole form rather than an auth wall', async () => {
    openDialog(makeContext());
    expect(await screen.findByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByText('Sign in & publish')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('community_signin_prompt_shown', {
      intent: 'publish',
    });
  });

  it('signed out: stashes the typed draft across the OAuth redirect', async () => {
    saveDisplayName('Andy');
    openDialog(makeContext());
    fireEvent.change(await screen.findByLabelText('Description'), {
      target: { value: 'Print at 0.2mm' },
    });
    await fillAndSubmit('Sign in & publish');
    fireEvent.click(await screen.findByText('Sign in with Google'));
    const pending = loadPendingPublishAction();
    expect(pending?.draft).toEqual({
      name: 'Screw Bin',
      description: 'Print at 0.2mm',
      category: 'tools',
    });
  });

  it('prefills the public name from a GitHub handle for a first-time publisher', async () => {
    signIn({
      userId: 'u1',
      provider: 'github',
      email: 'a@b.c',
      displayName: 'Andy Fullname',
      handle: 'octo-andy',
    });
    openDialog(makeContext());
    expect(await screen.findByLabelText(/Public name/)).toHaveValue('octo-andy');
  });

  it('never prefills the public name from a GitHub full name when the handle is missing', async () => {
    signIn({ userId: 'u1', provider: 'github', email: 'a@b.c', displayName: 'Andy Fullname' });
    openDialog(makeContext());
    expect(await screen.findByLabelText(/Public name/)).toHaveValue('');
  });

  it('never prefills the public name from a Google profile name', async () => {
    signIn({ userId: 'u1', provider: 'google', email: 'a@b.c', displayName: 'Andy Fullname' });
    openDialog(makeContext());
    expect(await screen.findByLabelText(/Public name/)).toHaveValue('');
  });

  it('collapses the public name for a returning publisher instead of a separate step', async () => {
    saveDisplayName('Andy');
    signIn();
    openDialog(makeContext());
    expect(await screen.findByText('Publishing as')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Public name/)).not.toBeInTheDocument();
  });

  it('shows the preparing state and forwards retry to the opener after a capture fault', async () => {
    saveDisplayName('Andy');
    signIn();
    const handlers = openDialog(makeContext(), makeHandlers(), false);
    expect(await screen.findByText('Preparing preview…')).toBeInTheDocument();
    expect(screen.queryByText('Retry preview')).not.toBeInTheDocument();
    act(() => useCommunityPublishStore.getState().setCaptureFailed());
    expect(await screen.findByText("Couldn't capture the preview.")).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry preview'));
    expect(handlers.requestRecapture).toHaveBeenCalledTimes(1);
  });

  it('publishes and offers both the link and a way to view it', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(publishDesign).mockResolvedValue(
      ok({ id: 'NewId1234567', url: 'https://example.com/community/d/NewId1234567' })
    );
    const handlers = openDialog(makeContext());
    await fillAndSubmit();
    expect(
      await screen.findByDisplayValue('https://example.com/community/d/NewId1234567')
    ).toBeInTheDocument();
    expect(publishDesign).toHaveBeenCalledTimes(1);
    expect(handlers.onPublished).toHaveBeenCalledWith('NewId1234567');
    expect(trackEvent).toHaveBeenCalledWith('community_publish', {
      is_remix: false,
      is_update: false,
    });
    expect(screen.getByText('View in the gallery')).toBeInTheDocument();
  });

  it('publishes under the public name the form carries', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(publishDesign).mockResolvedValue(
      ok({ id: 'NewId1234567', url: 'https://example.com/community/d/NewId1234567' })
    );
    openDialog(makeContext());
    await fillAndSubmit();
    await waitFor(() => expect(publishDesign).toHaveBeenCalled());
    expect(vi.mocked(publishDesign).mock.calls[0][0].authorName).toBe('Andy');
  });

  it('keeps the form mounted and routes a name rejection to the field', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(publishDesign).mockResolvedValue(
      err({ kind: 'validation', code: 'NAME_TOO_SHORT', message: 'x' })
    );
    openDialog(makeContext());
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Bin' } });
    await fillAndSubmit();
    expect(
      await screen.findByText('That name is too short. Give your design a descriptive name.')
    ).toBeInTheDocument();
    // No Back button, because the form never went away.
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Bin');
  });

  it('keeps typed fields visible when a publish is refused', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(publishDesign).mockResolvedValue(err({ kind: 'contentBlocked', message: 'blocked' }));
    openDialog(makeContext());
    fireEvent.change(await screen.findByLabelText('Description'), {
      target: { value: 'My long print notes' },
    });
    await fillAndSubmit();
    expect(
      await screen.findByText(
        'Some of the text was flagged by the content filter. Reword the name or description and try again.'
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('My long print notes');
  });

  it('INVALID_LINEAGE offers a strip-lineage retry that republishes standalone', async () => {
    saveDisplayName('Andy');
    signIn();
    // Parent fetch 404s so no identical-params interstitial and no parent hash.
    vi.mocked(fetchOwnDesign).mockResolvedValue(err({ kind: 'notFound' }));
    vi.mocked(publishDesign)
      .mockResolvedValueOnce(err({ kind: 'validation', code: 'INVALID_LINEAGE', message: 'x' }))
      .mockResolvedValueOnce(
        ok({ id: 'NewId1234567', url: 'https://example.com/community/d/NewId1234567' })
      );
    openDialog(
      makeContext({
        lineage: {
          parentId: 'Par123456789',
          rootId: 'Par123456789',
          parentName: 'Parent',
          parentAuthorName: 'Someone',
          rootAuthorName: 'Someone',
        },
      })
    );
    await fillAndSubmit();
    expect(
      await screen.findByText(
        "The design this remixes is no longer available, so it can't be credited."
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Publish without the remix link'));
    await waitFor(() =>
      expect(
        screen.getByDisplayValue('https://example.com/community/d/NewId1234567')
      ).toBeInTheDocument()
    );
    // The retry publishes with lineage stripped to null.
    expect(vi.mocked(publishDesign).mock.calls[1][1]).toBeNull();
  });

  it('shows quota message with the unpublish hint', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(publishDesign).mockResolvedValue(err({ kind: 'quotaExceeded', message: '' }));
    openDialog(makeContext());
    await fillAndSubmit();
    expect(
      await screen.findByText(
        'You have reached the limit of published designs. Unpublish one to make room.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Open a published design and choose Unpublish to make room.')
    ).toBeInTheDocument();
  });

  it('an expired session offers sign-in without discarding the form', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(publishDesign).mockResolvedValue(err({ kind: 'needsAuth' }));
    openDialog(makeContext());
    await fillAndSubmit();
    expect(
      await screen.findByText(
        'Your sign-in expired. Sign in again to finish publishing; your details are kept.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
  });

  it('an offline failure can be resubmitted straight from the form', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(publishDesign)
      .mockResolvedValueOnce(err({ kind: 'network' }))
      .mockResolvedValueOnce(
        ok({ id: 'NewId1234567', url: 'https://example.com/community/d/NewId1234567' })
      );
    openDialog(makeContext());
    await fillAndSubmit();
    expect(
      await screen.findByText('You appear to be offline. Check your connection and try again.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Publish'));
    expect(
      await screen.findByDisplayValue('https://example.com/community/d/NewId1234567')
    ).toBeInTheDocument();
    expect(publishDesign).toHaveBeenCalledTimes(2);
  });

  it('shows the identical-params interstitial for an unchanged remix, and publishes on confirm', async () => {
    saveDisplayName('Andy');
    signIn();
    const lineage = {
      parentId: 'Parent123456',
      rootId: 'Parent123456',
      parentName: 'Parent Bin',
      parentAuthorName: 'Alice',
      rootAuthorName: 'Alice',
    };
    vi.mocked(fetchOwnDesign).mockResolvedValue(ok(publishedRecord({ id: 'Parent123456' })));
    vi.mocked(publishDesign).mockResolvedValue(
      ok({ id: 'NewId1234567', url: 'https://example.com/community/d/NewId1234567' })
    );
    openDialog(makeContext({ lineage }));
    await waitFor(() => expect(fetchOwnDesign).toHaveBeenCalledWith('Parent123456'));
    await fillAndSubmit();
    expect(await screen.findByText('Publish an identical design?')).toBeInTheDocument();
    expect(publishDesign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Publish anyway'));
    await waitFor(() => expect(publishDesign).toHaveBeenCalledTimes(1));
    expect(trackEvent).toHaveBeenCalledWith('community_publish', {
      is_remix: true,
      is_update: false,
    });
  });

  it('update mode: prefills from the fetched record, updates in place', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(fetchOwnDesign).mockResolvedValue(ok(publishedRecord()));
    vi.mocked(updateDesign).mockResolvedValue(ok(publishedRecord()));
    openDialog(makeContext({ publishedId: 'Pub123456789' }));
    const nameInput = await screen.findByLabelText(/^Name/);
    expect(nameInput).toHaveValue('Published Name');
    fireEvent.click(screen.getByText('Update'));
    await waitFor(() => expect(updateDesign).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateDesign).mock.calls[0][0]).toBe('Pub123456789');
    expect(trackEvent).toHaveBeenCalledWith('community_publish', {
      is_remix: false,
      is_update: true,
    });
  });

  it('update mode falls back to create mode when the update hits a 404', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(fetchOwnDesign).mockResolvedValue(ok(publishedRecord()));
    vi.mocked(updateDesign).mockResolvedValue(err({ kind: 'notFound' }));
    const handlers = openDialog(makeContext({ publishedId: 'Pub123456789' }));
    await screen.findByLabelText(/^Name/);
    fireEvent.click(screen.getByText('Update'));
    expect(await screen.findByText('The published record no longer exists.')).toBeInTheDocument();
    expect(handlers.onUnpublished).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Publish')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Published Name');
  });

  it('update mode blocks the form behind a retry when the record fetch fails', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(fetchOwnDesign)
      .mockResolvedValueOnce(err({ kind: 'server' }))
      .mockResolvedValueOnce(ok(publishedRecord()));
    openDialog(makeContext({ publishedId: 'Pub123456789' }));
    expect(
      await screen.findByText(
        "Couldn't load the published details. Check your connection and try again."
      )
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByLabelText(/^Name/)).toHaveValue('Published Name');
  });

  it('opens in create mode when the published-record fetch 404s', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(fetchOwnDesign).mockResolvedValue(err({ kind: 'notFound' }));
    const handlers = openDialog(makeContext({ publishedId: 'Pub123456789' }));
    expect(await screen.findByText('Publish')).toBeInTheDocument();
    expect(handlers.onUnpublished).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Unpublish')).not.toBeInTheDocument();
  });

  it('does NOT sever the publishedId link on a 404 when the session is not live (hidden-design trap)', async () => {
    saveDisplayName('Andy');
    signIn();
    // The client thinks it is signed in, but the server session is dead: the
    // API 404s a hidden-but-recoverable design. getMe returning null must keep
    // the link instead of clearing it and minting a duplicate.
    vi.mocked(getMe).mockResolvedValue(null);
    vi.mocked(fetchOwnDesign).mockResolvedValue(err({ kind: 'notFound' }));
    const handlers = openDialog(makeContext({ publishedId: 'Pub123456789' }));
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    expect(handlers.onUnpublished).not.toHaveBeenCalled();
    expect(useCommunityPublishStore.getState().context?.publishedId).toBe('Pub123456789');
  });

  it('unpublish sits outside the primary footer and goes through the confirm dialog', async () => {
    saveDisplayName('Andy');
    signIn();
    vi.mocked(fetchOwnDesign).mockResolvedValue(ok(publishedRecord()));
    vi.mocked(unpublishDesign).mockResolvedValue(ok({ success: true }));
    const handlers = openDialog(makeContext({ publishedId: 'Pub123456789' }));
    expect(await screen.findByText('Remove from the showcase')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Unpublish'));
    expect(
      await screen.findByText(
        'It will be removed from the community showcase. Copies people already remixed are unaffected.'
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Unpublish').at(-1) as HTMLElement);
    await waitFor(() => expect(unpublishDesign).toHaveBeenCalledWith('Pub123456789'));
    await waitFor(() => expect(useCommunityPublishStore.getState().isOpen).toBe(false));
    expect(handlers.onUnpublished).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('community_unpublish');
  });
});
