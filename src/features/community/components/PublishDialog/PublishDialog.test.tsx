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
import { INITIAL_PUBLISH_DIALOG_STATE, usePublishDialogStore } from '../../store/publishStore';
import { saveDisplayName } from '../../utils/displayName';
import { fetchOwnDesign, publishDesign, unpublishDesign, updateDesign } from '../../api/client';
import { PublishDialog } from './PublishDialog';

vi.mock('../../api/client', () => ({
  publishDesign: vi.fn(),
  updateDesign: vi.fn(),
  unpublishDesign: vi.fn(),
  fetchOwnDesign: vi.fn(),
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

async function fillAndSubmit() {
  fireEvent.change(await screen.findByLabelText('Category'), {
    target: { value: 'tools' },
  });
  fireEvent.click(screen.getByText('Publish'));
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
  });

  it('signed out: shows the value line, sign-in buttons, and tracks the prompt', async () => {
    openDialog(makeContext());
    expect(
      await screen.findByText(
        'Share this design in the community showcase. Anyone can print it or remix it.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('community_signin_prompt_shown', {
      intent: 'publish',
    });
  });

  it('first publish while signed in: identity step, GitHub handle prefilled, continue reaches the form', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: {
        userId: 'u1',
        provider: 'github',
        email: 'a@b.c',
        displayName: 'Andy Fullname',
        handle: 'octo-andy',
      },
    });
    openDialog(makeContext());
    const input = await screen.findByLabelText('Public name');
    expect(input).toHaveValue('octo-andy');
    fireEvent.click(screen.getByText('Continue'));
    expect(await screen.findByText('Publish')).toBeInTheDocument();
  });

  it('never prefills the identity field from a GitHub full name when the handle is missing', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'github', email: 'a@b.c', displayName: 'Andy Fullname' },
    });
    openDialog(makeContext());
    expect(await screen.findByLabelText('Public name')).toHaveValue('');
  });

  it('never prefills the identity field from a Google profile name', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c', displayName: 'Andy Fullname' },
    });
    openDialog(makeContext());
    expect(await screen.findByLabelText('Public name')).toHaveValue('');
  });

  it('sign-in completing while the dialog is open advances past the signin step', async () => {
    saveDisplayName('Andy');
    openDialog(makeContext());
    expect(await screen.findByText('Sign in with Google')).toBeInTheDocument();
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    expect(await screen.findByText('Publish')).toBeInTheDocument();
  });

  it('shows the preparing state and forwards retry to the opener after a capture fault', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    const handlers = openDialog(makeContext(), makeHandlers(), false);
    expect(await screen.findByText('Preparing preview…')).toBeInTheDocument();
    expect(screen.queryByText('Retry preview')).not.toBeInTheDocument();
    act(() => useCommunityPublishStore.getState().setCaptureFailed());
    expect(await screen.findByText("Couldn't capture the preview.")).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry preview'));
    expect(handlers.requestRecapture).toHaveBeenCalledTimes(1);
  });

  it('publishes and shows the success state with the public link', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
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
    expect(screen.getByText('The community gallery is coming soon.')).toBeInTheDocument();
  });

  it('INVALID_LINEAGE: shows a real message and a strip-lineage retry that republishes standalone', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({ status: 'authenticated', user: LIVE_USER });
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

  it('shows the kill-switch message on a 503 with a way back to the form', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    vi.mocked(publishDesign).mockResolvedValue(err({ kind: 'disabled' }));
    openDialog(makeContext());
    await fillAndSubmit();
    expect(await screen.findByText('Publishing is not available yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(await screen.findByText('Publish')).toBeInTheDocument();
  });

  it('shows quota message with the unpublish hint', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
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

  it('keeps typed fields when returning to the form from an error', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
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
    fireEvent.click(screen.getByText('Back'));
    expect(await screen.findByLabelText('Description')).toHaveValue('My long print notes');
  });

  it('re-auth error state offers sign-in again and keeps the prompt analytics', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    vi.mocked(publishDesign).mockResolvedValue(err({ kind: 'needsAuth' }));
    openDialog(makeContext());
    await fillAndSubmit();
    expect(
      await screen.findByText(
        'Your sign-in expired. Sign in again to finish publishing; your details are kept.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('community_signin_prompt_shown', {
      intent: 'publish',
    });
  });

  it('offline error offers try again, which retries the publish', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
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
    fireEvent.click(screen.getByText('Try again'));
    expect(
      await screen.findByDisplayValue('https://example.com/community/d/NewId1234567')
    ).toBeInTheDocument();
    expect(publishDesign).toHaveBeenCalledTimes(2);
  });

  it('shows the identical-params interstitial for an unchanged remix, and publishes on confirm', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
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
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    vi.mocked(fetchOwnDesign).mockResolvedValue(ok(publishedRecord()));
    vi.mocked(updateDesign).mockResolvedValue(ok(publishedRecord()));
    openDialog(makeContext({ publishedId: 'Pub123456789' }));
    const nameInput = await screen.findByLabelText('Name');
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
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    vi.mocked(fetchOwnDesign).mockResolvedValue(ok(publishedRecord()));
    vi.mocked(updateDesign).mockResolvedValue(err({ kind: 'notFound' }));
    const handlers = openDialog(makeContext({ publishedId: 'Pub123456789' }));
    await screen.findByLabelText('Name');
    fireEvent.click(screen.getByText('Update'));
    expect(await screen.findByText('The published record no longer exists.')).toBeInTheDocument();
    expect(handlers.onUnpublished).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Back'));
    expect(await screen.findByText('Publish')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Published Name');
  });

  it('update mode blocks the form behind a retry when the record fetch fails', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    vi.mocked(fetchOwnDesign)
      .mockResolvedValueOnce(err({ kind: 'server' }))
      .mockResolvedValueOnce(ok(publishedRecord()));
    openDialog(makeContext({ publishedId: 'Pub123456789' }));
    expect(
      await screen.findByText(
        "Couldn't load the published details. Check your connection and try again."
      )
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByLabelText('Name')).toHaveValue('Published Name');
  });

  it('opens in create mode when the published-record fetch 404s', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    vi.mocked(fetchOwnDesign).mockResolvedValue(err({ kind: 'notFound' }));
    const handlers = openDialog(makeContext({ publishedId: 'Pub123456789' }));
    expect(await screen.findByText('Publish')).toBeInTheDocument();
    expect(handlers.onUnpublished).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Unpublish')).not.toBeInTheDocument();
  });

  it('does NOT sever the publishedId link on a 404 when the session is not live (hidden-design trap)', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({ status: 'authenticated', user: LIVE_USER });
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

  it('unpublish goes through the confirm dialog and closes on success', async () => {
    saveDisplayName('Andy');
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    vi.mocked(fetchOwnDesign).mockResolvedValue(ok(publishedRecord()));
    vi.mocked(unpublishDesign).mockResolvedValue(ok({ success: true }));
    const handlers = openDialog(makeContext({ publishedId: 'Pub123456789' }));
    fireEvent.click(await screen.findByText('Unpublish'));
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
