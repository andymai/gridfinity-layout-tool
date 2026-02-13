import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedbackSubmit } from './useFeedbackSubmit';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('useFeedbackSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useFeedbackSubmit());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('validates required description', async () => {
    const { result } = renderHook(() => useFeedbackSubmit());

    await act(async () => {
      const success = await result.current.submit({
        category: 'general',
        description: '',
      });
      expect(success).toBe(false);
    });

    expect(result.current.error).toBe('feedback.descriptionRequired');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('submits successfully and returns true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useFeedbackSubmit());

    await act(async () => {
      const success = await result.current.submit({
        category: 'feature_request',
        description: 'Would be nice to have dark mode support.',
      });
      expect(success).toBe(true);
    });

    expect(result.current.status).toBe('success');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/feedback',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uses rate limit i18n key on 429', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    const { result } = renderHook(() => useFeedbackSubmit());

    await act(async () => {
      const success = await result.current.submit({
        category: 'bug_report',
        description: 'Bug description',
      });
      expect(success).toBe(false);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('feedback.errorRateLimit');
  });

  it('uses generic i18n key on other API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useFeedbackSubmit());

    await act(async () => {
      const success = await result.current.submit({
        category: 'general',
        description: 'Some feedback',
      });
      expect(success).toBe(false);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('feedback.errorGeneric');
  });

  it('handles network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useFeedbackSubmit());

    await act(async () => {
      const success = await result.current.submit({
        category: 'feature_request',
        description: 'Some feedback',
      });
      expect(success).toBe(false);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('feedback.errorGeneric');
  });

  it('resets state', async () => {
    const { result } = renderHook(() => useFeedbackSubmit());

    await act(async () => {
      await result.current.submit({ category: 'general', description: '' });
    });
    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
