/**
 * QR Bridge hook for mobile-to-desktop image transfer.
 *
 * Creates a session, generates QR code URL, and polls for uploaded images.
 * Enables users to photograph tools on mobile and transfer them to desktop.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Session status from the API.
 */
export type SessionStatus = 'idle' | 'pending' | 'ready' | 'error' | 'expired';

/**
 * Session data returned by the API.
 */
interface SessionResponse {
  status: 'pending' | 'ready';
  imageUrl?: string;
  imageName?: string;
}

/**
 * Create session response.
 */
interface CreateSessionResponse {
  sessionId: string;
  expiresAt: string;
  uploadUrl: string;
}

/**
 * QR Bridge state.
 */
export interface QRBridgeState {
  /** Current session status */
  status: SessionStatus;
  /** Session ID (null if no active session) */
  sessionId: string | null;
  /** URL for the mobile upload page */
  uploadUrl: string | null;
  /** URL of the uploaded image (when ready) */
  imageUrl: string | null;
  /** Name of the uploaded image */
  imageName: string | null;
  /** Session expiry timestamp */
  expiresAt: Date | null;
  /** Error message if any */
  error: string | null;
  /** Whether the session is being created */
  isCreating: boolean;
  /** Whether polling is active */
  isPolling: boolean;
}

/**
 * QR Bridge hook return type.
 */
export interface UseQRBridgeReturn extends QRBridgeState {
  /** Create a new session and start polling */
  startSession: () => Promise<void>;
  /** Stop polling and optionally cleanup the session */
  cancelSession: (cleanup?: boolean) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Polling interval in milliseconds (2 seconds).
 */
const POLL_INTERVAL_MS = 2000;

/**
 * Maximum poll attempts before giving up (5 minutes).
 */
const MAX_POLL_ATTEMPTS = 150;

/**
 * Hook for managing the QR Bridge mobile-to-desktop image transfer.
 */
export function useQRBridge(): UseQRBridgeReturn {
  const [state, setState] = useState<QRBridgeState>({
    status: 'idle',
    sessionId: null,
    uploadUrl: null,
    imageUrl: null,
    imageName: null,
    expiresAt: null,
    error: null,
    isCreating: false,
    isPolling: false,
  });

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Stop polling.
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  /**
   * Poll for session status.
   */
  const pollSession = useCallback(
    async (sessionId: string, expiresAt: Date) => {
      // Check if session has expired
      if (new Date() >= expiresAt) {
        stopPolling();
        setState((prev) => ({
          ...prev,
          status: 'expired',
          isPolling: false,
          error: 'Session expired',
        }));
        return;
      }

      // Check poll count
      pollCountRef.current++;
      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        stopPolling();
        setState((prev) => ({
          ...prev,
          status: 'expired',
          isPolling: false,
          error: 'Session timed out',
        }));
        return;
      }

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(`/api/cutout-session/${sessionId}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            stopPolling();
            setState((prev) => ({
              ...prev,
              status: 'expired',
              isPolling: false,
              error: 'Session not found or expired',
            }));
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as SessionResponse;

        if (data.status === 'ready' && data.imageUrl) {
          stopPolling();
          setState((prev) => ({
            ...prev,
            status: 'ready',
            imageUrl: data.imageUrl ?? null,
            imageName: data.imageName ?? null,
            isPolling: false,
          }));
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        // Don't stop polling on network errors, just log
        console.warn('Poll error:', error);
      }
    },
    [stopPolling]
  );

  /**
   * Start a new session.
   */
  const startSession = useCallback(async () => {
    // Cleanup any existing session
    stopPolling();

    setState((prev) => ({
      ...prev,
      status: 'idle',
      isCreating: true,
      error: null,
    }));

    try {
      const response = await fetch('/api/cutout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as CreateSessionResponse;
      const expiresAt = new Date(data.expiresAt);

      // Build upload page URL (relative path that mobile can access)
      const baseUrl = window.location.origin;
      const uploadPageUrl = `${baseUrl}/cutout-upload?session=${data.sessionId}`;

      setState({
        status: 'pending',
        sessionId: data.sessionId,
        uploadUrl: uploadPageUrl,
        imageUrl: null,
        imageName: null,
        expiresAt,
        error: null,
        isCreating: false,
        isPolling: true,
      });

      // Start polling
      pollCountRef.current = 0;
      pollIntervalRef.current = setInterval(() => {
        void pollSession(data.sessionId, expiresAt);
      }, POLL_INTERVAL_MS);

      // Do an initial poll immediately
      void pollSession(data.sessionId, expiresAt);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
      }));
    }
  }, [pollSession, stopPolling]);

  /**
   * Cancel the current session.
   */
  const cancelSession = useCallback(
    async (cleanup = true) => {
      const { sessionId } = state;
      stopPolling();

      if (cleanup && sessionId) {
        try {
          await fetch(`/api/cutout-session/${sessionId}`, {
            method: 'DELETE',
          });
        } catch {
          // Ignore cleanup errors
        }
      }

      setState({
        status: 'idle',
        sessionId: null,
        uploadUrl: null,
        imageUrl: null,
        imageName: null,
        expiresAt: null,
        error: null,
        isCreating: false,
        isPolling: false,
      });
    },
    [state, stopPolling]
  );

  /**
   * Reset to idle state without cleanup.
   */
  const reset = useCallback(() => {
    stopPolling();
    setState({
      status: 'idle',
      sessionId: null,
      uploadUrl: null,
      imageUrl: null,
      imageName: null,
      expiresAt: null,
      error: null,
      isCreating: false,
      isPolling: false,
    });
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    ...state,
    startSession,
    cancelSession,
    reset,
  };
}
