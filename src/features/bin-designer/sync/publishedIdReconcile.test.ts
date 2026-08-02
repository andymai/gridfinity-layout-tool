import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err, apiServerError, storageNotFound } from '@/core/result';
import { designId } from '@/core/types';
import { useSessionStore } from '@/core/sync/session/useSession';

const probeMock = vi.fn();
const clearMock = vi.fn();
const getMeMock = vi.fn();

vi.mock('@/core/api/communityClient', () => ({
  probeCommunityDesign: (id: string) => probeMock(id),
}));

vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  clearDesignPublishedId: (id: string) => clearMock(id),
}));

vi.mock('@/core/sync/session/sessionApi', () => ({
  getMe: () => getMeMock(),
}));

import { reconcilePublishedId, __resetPublishedIdReconcileForTests } from './publishedIdReconcile';

beforeEach(() => {
  vi.clearAllMocks();
  __resetPublishedIdReconcileForTests();
  clearMock.mockResolvedValue(ok(undefined));
  getMeMock.mockResolvedValue({ userId: 'u1', provider: 'google', email: 'a@b.c' });
  useSessionStore.setState({
    status: 'authenticated',
    user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
  });
});

describe('reconcilePublishedId', () => {
  it('does not probe without an authenticated session (a 404 would not be definitive)', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    await reconcilePublishedId({ id: designId('d1'), publishedId: 'AbCdEf123456' });
    useSessionStore.setState({ status: 'unknown', user: null });
    await reconcilePublishedId({ id: designId('d1'), publishedId: 'AbCdEf123456' });
    expect(probeMock).not.toHaveBeenCalled();
    expect(clearMock).not.toHaveBeenCalled();
  });

  it('probes again once the session is authenticated', async () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    const design = { id: designId('d1'), publishedId: 'AbCdEf123456' };
    await reconcilePublishedId(design);
    expect(probeMock).not.toHaveBeenCalled();
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
    });
    probeMock.mockResolvedValueOnce(ok('live'));
    await reconcilePublishedId(design);
    expect(probeMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the design has no publishedId', async () => {
    await reconcilePublishedId({ id: designId('d1'), publishedId: undefined });
    await reconcilePublishedId({ id: designId('d2'), publishedId: null });
    expect(probeMock).not.toHaveBeenCalled();
    expect(clearMock).not.toHaveBeenCalled();
  });

  it('keeps the publishedId when the community record is live', async () => {
    probeMock.mockResolvedValueOnce(ok('live'));
    await reconcilePublishedId({ id: designId('d1'), publishedId: 'AbCdEf123456' });
    expect(probeMock).toHaveBeenCalledWith('AbCdEf123456');
    expect(clearMock).not.toHaveBeenCalled();
  });

  it('clears the publishedId on a 404 once the server confirms the session is live', async () => {
    probeMock.mockResolvedValueOnce(ok('missing'));
    await reconcilePublishedId({ id: designId('d1'), publishedId: 'AbCdEf123456' });
    expect(getMeMock).toHaveBeenCalledTimes(1);
    expect(clearMock).toHaveBeenCalledWith('d1');
  });

  it('keeps the publishedId on a 404 when the server session has expired', async () => {
    probeMock.mockResolvedValue(ok('missing'));
    getMeMock.mockResolvedValueOnce(null);
    const design = { id: designId('d1'), publishedId: 'AbCdEf123456' };
    await reconcilePublishedId(design);
    expect(clearMock).not.toHaveBeenCalled();
    await reconcilePublishedId(design);
    expect(probeMock).toHaveBeenCalledTimes(2);
    expect(clearMock).toHaveBeenCalledWith('d1');
  });

  it('keeps the publishedId on a 404 when the session check itself fails', async () => {
    probeMock.mockResolvedValueOnce(ok('missing'));
    getMeMock.mockRejectedValueOnce(new Error('offline'));
    await reconcilePublishedId({ id: designId('d1'), publishedId: 'AbCdEf123456' });
    expect(clearMock).not.toHaveBeenCalled();
  });

  it('keeps the publishedId on an indeterminate probe failure', async () => {
    probeMock.mockResolvedValueOnce(err(apiServerError(503)));
    await reconcilePublishedId({ id: designId('d1'), publishedId: 'AbCdEf123456' });
    expect(clearMock).not.toHaveBeenCalled();
  });

  it('probes each id + publishedId pair once per session', async () => {
    probeMock.mockResolvedValue(ok('live'));
    const design = { id: designId('d1'), publishedId: 'AbCdEf123456' };
    await reconcilePublishedId(design);
    await reconcilePublishedId(design);
    expect(probeMock).toHaveBeenCalledTimes(1);

    await reconcilePublishedId({ id: designId('d1'), publishedId: 'NewPublish99' });
    expect(probeMock).toHaveBeenCalledTimes(2);
  });

  it('retries the probe on a later load after a failure', async () => {
    probeMock.mockResolvedValueOnce(err(apiServerError(503))).mockResolvedValueOnce(ok('missing'));
    const design = { id: designId('d1'), publishedId: 'AbCdEf123456' };
    await reconcilePublishedId(design);
    await reconcilePublishedId(design);
    expect(probeMock).toHaveBeenCalledTimes(2);
    expect(clearMock).toHaveBeenCalledWith('d1');
  });

  it('tolerates a failed local clear', async () => {
    probeMock.mockResolvedValueOnce(ok('missing'));
    clearMock.mockResolvedValueOnce(err(storageNotFound('d1')));
    await expect(
      reconcilePublishedId({ id: designId('d1'), publishedId: 'AbCdEf123456' })
    ).resolves.toBeUndefined();
  });
});
