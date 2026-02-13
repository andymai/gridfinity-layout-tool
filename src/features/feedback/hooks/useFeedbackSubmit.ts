import { useState, useCallback } from 'react';
import type { FeedbackPayload } from '../types';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

interface UseFeedbackSubmitReturn {
  status: SubmitStatus;
  error: string | null;
  submit: (payload: FeedbackPayload) => Promise<boolean>;
  reset: () => void;
}

export function useFeedbackSubmit(): UseFeedbackSubmitReturn {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (payload: FeedbackPayload): Promise<boolean> => {
    if (!payload.description.trim()) {
      setError('feedback.descriptionRequired');
      setStatus('error');
      return false;
    }

    setStatus('submitting');
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorKey =
          response.status === 429 ? 'feedback.errorRateLimit' : 'feedback.errorGeneric';
        setError(errorKey);
        setStatus('error');
        return false;
      }

      setStatus('success');
      return true;
    } catch {
      setError('feedback.errorGeneric');
      setStatus('error');
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, submit, reset };
}
