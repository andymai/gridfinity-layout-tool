# Feedback Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a feedback modal in the header that submits product feedback as GitHub Issues via a Vercel serverless endpoint.

**Architecture:** New `src/features/feedback/` vertical slice with a lazy-loaded FeedbackModal in the Header. A `useFeedbackSubmit` hook handles form state and API calls. The `api/feedback.ts` endpoint validates input, checks rate limits, and creates GitHub Issues using a server-side PAT. Command palette integration via CustomEvent pattern.

**Tech Stack:** React 19, Zustand (toast store), Dialog design-system component, Vercel serverless, GitHub REST API, i18n.

**Design doc:** `docs/plans/2026-02-12-feedback-feature-design.md`

---

### Task 1: Types and Constants

**Files:**

- Create: `src/features/feedback/types.ts`

**Step 1: Create the types file**

```typescript
// src/features/feedback/types.ts

export type FeedbackCategory = 'feature_request' | 'bug_report' | 'general';

export interface FeedbackContext {
  drawerSize: string;
  binCount: number;
  layerCount: number;
  browser: string;
  halfBinMode: boolean;
  locale: string;
}

export interface FeedbackPayload {
  category: FeedbackCategory;
  title: string;
  description: string;
  email?: string;
  context?: FeedbackContext;
  hp?: string;
}

export interface FeedbackResponse {
  success: boolean;
  error?: string;
}

export const FEEDBACK_CONSTRAINTS = {
  TITLE_MAX: 100,
  DESCRIPTION_MAX: 2000,
  EMAIL_MAX: 254,
} as const;
```

**Step 2: Commit**

```bash
git add src/features/feedback/types.ts
git commit -m "feat(feedback): add types and constants"
```

---

### Task 2: i18n Keys

**Files:**

- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/de.json`, `es.json`, `fr.json`, `nb.json`, `nl.json`, `pt-BR.json`

**Step 1: Add English keys to `en.ts`**

Add these keys (find a good alphabetical location or add after the last existing section):

```typescript
// Feedback
'feedback.title': 'Send Feedback',
'feedback.categoryLabel': 'Category',
'feedback.categoryFeature': 'Feature Request',
'feedback.categoryBug': 'Bug Report',
'feedback.categoryGeneral': 'General Feedback',
'feedback.titleLabel': 'Title',
'feedback.titlePlaceholder': 'Brief summary of your feedback',
'feedback.descriptionLabel': 'Description',
'feedback.descriptionPlaceholder': 'Tell us more...',
'feedback.emailLabel': 'Email (optional)',
'feedback.emailPlaceholder': 'For follow-up only',
'feedback.includeContext': 'Include layout info to help debug',
'feedback.includeContextTooltip': 'Attaches drawer size, bin/layer count, browser, and locale',
'feedback.submit': 'Submit Feedback',
'feedback.submitting': 'Submitting...',
'feedback.cancel': 'Cancel',
'feedback.successToast': 'Feedback submitted — thank you!',
'feedback.errorGeneric': 'Failed to submit feedback. Please try again.',
'feedback.errorRateLimit': 'Too many submissions. Please try again later.',
'feedback.titleRequired': 'Title is required',
'feedback.descriptionRequired': 'Description is required',
'header.sendFeedback': 'Feedback',
'commandPalette.sendFeedback': 'Send Feedback',
```

**Step 2: Add matching keys to all 6 locale JSON files**

Use the same English text as placeholder values (translations can be done separately). Each locale file needs all the same keys added.

**Step 3: Verify i18n**

Run: `npm run check:i18n`
Expected: All locale files have matching keys.

**Step 4: Commit**

```bash
git add src/i18n/
git commit -m "feat(feedback): add i18n keys for feedback feature"
```

---

### Task 3: Rate Limit Action

**Files:**

- Modify: `api/lib/rateLimit.ts`

**Step 1: Add `'feedback'` to `RateLimitAction` type**

In `api/lib/rateLimit.ts` line 5, add `'feedback'` to the union:

```typescript
export type RateLimitAction =
  | 'create'
  | 'update'
  | 'view'
  | 'delete'
  | 'report'
  | 'telemetry'
  | 'suggest'
  | 'feedback';
```

**Step 2: Add rate limit config**

In the `RATE_LIMITS` object (line ~28), add:

```typescript
feedback: { limit: 5, windowSeconds: 3600 }, // 5/hour
```

**Step 3: Commit**

```bash
git add api/lib/rateLimit.ts
git commit -m "feat(feedback): add feedback rate limit action (5/hour)"
```

---

### Task 4: API Endpoint

**Files:**

- Create: `api/feedback.ts`

**Step 1: Create the endpoint**

````typescript
// api/feedback.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit';

const GITHUB_REPO = 'andymai/gridfinity-layout-tool';

const CATEGORY_LABELS: Record<string, string> = {
  feature_request: 'Feature Request',
  bug_report: 'Bug Report',
  general: 'General',
};

const CATEGORY_ISSUE_LABELS: Record<string, string> = {
  feature_request: 'feedback: feature',
  bug_report: 'feedback: bug',
  general: 'feedback: general',
};

const VALID_CATEGORIES = new Set(['feature_request', 'bug_report', 'general']);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function buildIssueBody(
  description: string,
  email?: string,
  context?: Record<string, unknown>
): string {
  let body = description;

  if (context) {
    body += '\n\n<details><summary>Layout Context</summary>\n\n```json\n';
    body += JSON.stringify(context, null, 2);
    body += '\n```\n\n</details>';
  }

  if (email) {
    body += `\n\n<details><summary>Contact</summary>\n\n${email}\n\n</details>`;
  }

  return body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) {
    console.error('[Feedback] GITHUB_FEEDBACK_TOKEN not configured');
    return res.status(500).json({ error: 'Feedback not configured' });
  }

  try {
    // Rate limit
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'feedback');
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many submissions. Please try again later.',
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    // Honeypot check
    if (body.hp && typeof body.hp === 'string' && body.hp.length > 0) {
      // Silently accept but don't create issue (looks successful to bots)
      return res.status(200).json({ success: true });
    }

    // Validate required fields
    const { category, title, description, email, context } = body;

    if (typeof category !== 'string' || !VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (title.length > 100) {
      return res.status(400).json({ error: 'Title too long (max 100 characters)' });
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (description.length > 2000) {
      return res.status(400).json({ error: 'Description too long (max 2000 characters)' });
    }
    if (email !== undefined && (typeof email !== 'string' || !isValidEmail(email))) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Create GitHub issue
    const issueTitle = `[Feedback] ${CATEGORY_LABELS[category]}: ${title.trim()}`;
    const issueBody = buildIssueBody(
      description.trim(),
      typeof email === 'string' ? email : undefined,
      context && typeof context === 'object' ? (context as Record<string, unknown>) : undefined
    );

    const ghResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: [CATEGORY_ISSUE_LABELS[category]],
      }),
    });

    if (!ghResponse.ok) {
      const errorText = await ghResponse.text();
      console.error('[Feedback] GitHub API error:', ghResponse.status, errorText);
      return res.status(502).json({ error: 'Failed to submit feedback' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Feedback] Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
````

**Step 2: Commit**

```bash
git add api/feedback.ts
git commit -m "feat(feedback): add serverless endpoint for GitHub Issues"
```

---

### Task 5: useFeedbackSubmit Hook

**Files:**

- Create: `src/features/feedback/hooks/useFeedbackSubmit.ts`
- Create: `src/features/feedback/hooks/useFeedbackSubmit.test.ts`

**Step 1: Write the failing test**

```typescript
// src/features/feedback/hooks/useFeedbackSubmit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedbackSubmit } from './useFeedbackSubmit';

// Mock fetch globally
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

  it('validates required title', async () => {
    const { result } = renderHook(() => useFeedbackSubmit());

    await act(async () => {
      const success = await result.current.submit({
        category: 'general',
        title: '',
        description: 'Some description',
      });
      expect(success).toBe(false);
    });

    expect(result.current.error).toBe('feedback.titleRequired');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('validates required description', async () => {
    const { result } = renderHook(() => useFeedbackSubmit());

    await act(async () => {
      const success = await result.current.submit({
        category: 'general',
        title: 'A title',
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
        title: 'Add dark mode',
        description: 'Would be nice to have dark mode support.',
      });
      expect(success).toBe(true);
    });

    expect(result.current.status).toBe('success');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/feedback',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('handles API error and returns false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many submissions. Please try again later.' }),
    });

    const { result } = renderHook(() => useFeedbackSubmit());

    await act(async () => {
      const success = await result.current.submit({
        category: 'bug_report',
        title: 'Bug title',
        description: 'Bug description',
      });
      expect(success).toBe(false);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeTruthy();
  });

  it('resets state', async () => {
    const { result } = renderHook(() => useFeedbackSubmit());

    // Trigger an error first
    await act(async () => {
      await result.current.submit({
        category: 'general',
        title: '',
        description: 'desc',
      });
    });
    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/feedback/hooks/useFeedbackSubmit.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the hook**

```typescript
// src/features/feedback/hooks/useFeedbackSubmit.ts
import { useState, useCallback } from 'react';
import type { FeedbackPayload, FeedbackResponse } from '../types';

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
    // Client-side validation
    if (!payload.title.trim()) {
      setError('feedback.titleRequired');
      setStatus('error');
      return false;
    }
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

      const data = (await response.json()) as FeedbackResponse;

      if (!response.ok || !data.success) {
        const errorKey =
          response.status === 429 ? 'feedback.errorRateLimit' : 'feedback.errorGeneric';
        setError(data.error ?? errorKey);
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/feedback/hooks/useFeedbackSubmit.test.ts`
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/features/feedback/hooks/
git commit -m "feat(feedback): add useFeedbackSubmit hook with tests"
```

---

### Task 6: FeedbackModal Component

**Files:**

- Create: `src/features/feedback/components/FeedbackModal.tsx`
- Create: `src/features/feedback/components/FeedbackModal.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/features/feedback/components/FeedbackModal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackModal } from './FeedbackModal';

// Mock the submit hook
const mockSubmit = vi.fn();
const mockReset = vi.fn();
vi.mock('../hooks/useFeedbackSubmit', () => ({
  useFeedbackSubmit: () => ({
    status: 'idle',
    error: null,
    submit: mockSubmit,
    reset: mockReset,
  }),
}));

// Mock i18n to return key as value
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// Mock stores
vi.mock('@/core/store', () => ({
  useLayoutStore: Object.assign(() => ({
    layout: {
      drawer: { width: 6, depth: 4, height: 5 },
      bins: [{ id: '1' }],
      layers: [{ id: 'l1' }],
    },
  }), {
    getState: () => ({
      layout: {
        drawer: { width: 6, depth: 4, height: 5 },
        bins: [{ id: '1' }],
        layers: [{ id: 'l1' }],
      },
    }),
  }),
  useHalfBinModeStore: Object.assign(() => false, {
    getState: () => ({ halfBinMode: false }),
  }),
  useToastStore: Object.assign(() => vi.fn(), {
    getState: () => ({ addToast: vi.fn() }),
  }),
}));

describe('FeedbackModal', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue(true);
  });

  it('renders form fields when open', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByLabelText('feedback.categoryLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('feedback.titleLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('feedback.descriptionLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('feedback.emailLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('feedback.includeContext')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<FeedbackModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('feedback.titleLabel')).not.toBeInTheDocument();
  });

  it('submits form with entered values', async () => {
    const onClose = vi.fn();
    render(<FeedbackModal isOpen={true} onClose={onClose} />);

    await user.type(screen.getByLabelText('feedback.titleLabel'), 'My title');
    await user.type(screen.getByLabelText('feedback.descriptionLabel'), 'My description');
    await user.click(screen.getByRole('button', { name: 'feedback.submit' }));

    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: 'My title',
      description: 'My description',
      category: 'feature_request',
    }));
  });

  it('includes honeypot field (hidden)', () => {
    const { container } = render(<FeedbackModal isOpen={true} onClose={vi.fn()} />);
    const honeypot = container.querySelector('input[name="hp"]');
    expect(honeypot).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn();
    render(<FeedbackModal isOpen={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'feedback.cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/feedback/components/FeedbackModal.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the component**

```tsx
// src/features/feedback/components/FeedbackModal.tsx
import { useState, useCallback } from 'react';
import { Dialog } from '@/design-system/Dialog';
import { useTranslation } from '@/i18n';
import { useLayoutStore, useHalfBinModeStore, useToastStore } from '@/core/store';
import { useFeedbackSubmit } from '../hooks/useFeedbackSubmit';
import type { FeedbackCategory, FeedbackContext } from '../types';
import { FEEDBACK_CONSTRAINTS } from '../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function gatherContext(): FeedbackContext {
  const { layout } = useLayoutStore.getState();
  const { halfBinMode } = useHalfBinModeStore.getState();
  return {
    drawerSize: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    binCount: layout.bins.length,
    layerCount: layout.layers.length,
    browser: navigator.userAgent,
    halfBinMode,
    locale: document.documentElement.lang || 'en',
  };
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { status, error, submit, reset } = useFeedbackSubmit();

  const [category, setCategory] = useState<FeedbackCategory>('feature_request');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [includeContext, setIncludeContext] = useState(false);
  const [hp, setHp] = useState('');

  const resetForm = useCallback(() => {
    setCategory('feature_request');
    setTitle('');
    setDescription('');
    setEmail('');
    setIncludeContext(false);
    setHp('');
    reset();
  }, [reset]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const payload = {
        category,
        title,
        description,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(includeContext ? { context: gatherContext() } : {}),
        ...(hp ? { hp } : {}),
      };

      const success = await submit(payload);
      if (success) {
        addToast(t('feedback.successToast'), 'success');
        handleClose();
      }
    },
    [category, title, description, email, includeContext, hp, submit, addToast, t, handleClose]
  );

  if (!isOpen) return null;

  const isSubmitting = status === 'submitting';

  return (
    <Dialog.Root open={isOpen} onClose={handleClose}>
      <Dialog.Header title={t('feedback.title')} />
      <Dialog.Body>
        <form id="feedback-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Honeypot — hidden from users, visible to bots */}
          <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
            <input
              type="text"
              name="hp"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-category" className="text-sm font-medium text-content">
              {t('feedback.categoryLabel')}
            </label>
            <select
              id="feedback-category"
              aria-label={t('feedback.categoryLabel')}
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              className="px-3 py-2 rounded-md text-sm bg-surface-elevated border border-stroke-subtle text-content"
            >
              <option value="feature_request">{t('feedback.categoryFeature')}</option>
              <option value="bug_report">{t('feedback.categoryBug')}</option>
              <option value="general">{t('feedback.categoryGeneral')}</option>
            </select>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-title" className="text-sm font-medium text-content">
              {t('feedback.titleLabel')}
            </label>
            <input
              id="feedback-title"
              aria-label={t('feedback.titleLabel')}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('feedback.titlePlaceholder')}
              maxLength={FEEDBACK_CONSTRAINTS.TITLE_MAX}
              className="px-3 py-2 rounded-md text-sm bg-surface-elevated border border-stroke-subtle text-content placeholder:text-content-tertiary"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-description" className="text-sm font-medium text-content">
              {t('feedback.descriptionLabel')}
            </label>
            <textarea
              id="feedback-description"
              aria-label={t('feedback.descriptionLabel')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('feedback.descriptionPlaceholder')}
              maxLength={FEEDBACK_CONSTRAINTS.DESCRIPTION_MAX}
              rows={5}
              className="px-3 py-2 rounded-md text-sm bg-surface-elevated border border-stroke-subtle text-content placeholder:text-content-tertiary resize-y"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-email" className="text-sm font-medium text-content">
              {t('feedback.emailLabel')}
            </label>
            <input
              id="feedback-email"
              aria-label={t('feedback.emailLabel')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('feedback.emailPlaceholder')}
              maxLength={FEEDBACK_CONSTRAINTS.EMAIL_MAX}
              className="px-3 py-2 rounded-md text-sm bg-surface-elevated border border-stroke-subtle text-content placeholder:text-content-tertiary"
            />
          </div>

          {/* Include context checkbox */}
          <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
            <input
              type="checkbox"
              aria-label={t('feedback.includeContext')}
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="rounded border-stroke-subtle"
            />
            <span>{t('feedback.includeContext')}</span>
          </label>

          {/* Error message */}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {t(error)}
            </p>
          )}
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <button
          type="button"
          onClick={handleClose}
          className="btn btn-ghost"
          aria-label={t('feedback.cancel')}
        >
          {t('feedback.cancel')}
        </button>
        <button
          type="submit"
          form="feedback-form"
          disabled={isSubmitting}
          className="btn btn-primary"
          aria-label={t('feedback.submit')}
        >
          {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
        </button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/feedback/`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/features/feedback/components/
git commit -m "feat(feedback): add FeedbackModal component with tests"
```

---

### Task 7: Header Integration

**Files:**

- Modify: `src/components/Header/Header.tsx`

**Step 1: Add feedback button and lazy-loaded modal to Header**

At the top of `Header.tsx`, add the lazy import (alongside the existing lazy loads at lines 26-38):

```typescript
const FeedbackModal = lazyWithRetry(() =>
  import('@/features/feedback/components/FeedbackModal').then(namedExport('FeedbackModal'))
);
```

Inside the `Header` component, add state:

```typescript
const [showFeedback, setShowFeedback] = useState(false);
```

Add a `useEffect` for the custom event (for command palette integration), following the same pattern as settings in `Sidebar.tsx`:

```typescript
useEffect(() => {
  const handleOpenFeedback = () => setShowFeedback(true);
  window.addEventListener('open-feedback-modal', handleOpenFeedback);
  return () => window.removeEventListener('open-feedback-modal', handleOpenFeedback);
}, []);
```

Add the feedback button in the right side of the header, between the language selector and help button (around line 371). Follow the exact same button style as the help and GitHub buttons:

```tsx
{
  /* Feedback button */
}
<button
  onClick={() => setShowFeedback(true)}
  className="btn btn-ghost px-2.5 py-1.5 text-sm text-content-secondary flex items-center gap-1.5"
  title={t('header.sendFeedback')}
  aria-label={t('header.sendFeedback')}
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
  <span className="hidden lg:inline">{t('header.sendFeedback')}</span>
</button>;
```

Add the lazy-loaded modal at the bottom of the return, alongside the other modals (before the closing `</header>`):

```tsx
{
  showFeedback && (
    <Suspense fallback={null}>
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </Suspense>
  );
}
```

**Step 2: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/Header/Header.tsx
git commit -m "feat(feedback): add feedback button to header with lazy-loaded modal"
```

---

### Task 8: Command Palette Integration

**Files:**

- Modify: `src/features/command-palette/commands.ts`
- Modify: `src/features/command-palette/components/CommandPalette/CommandPalette.tsx`

**Step 1: Add command definition**

In `commands.ts`, add to the Navigation section (after `open-print` around line 100):

```typescript
{
  id: 'send-feedback',
  labelKey: 'commandPalette.sendFeedback',
  category: 'navigation',
  keywords: ['feedback', 'report', 'bug', 'suggestion', 'contact', 'feature'],
},
```

**Step 2: Add command handler**

In `CommandPalette.tsx`, find the `switch` statement that maps command IDs to actions (around line 118). Add after the `open-print` case:

```typescript
case 'send-feedback':
  return () => window.dispatchEvent(new CustomEvent('open-feedback-modal'));
```

**Step 3: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/features/command-palette/
git commit -m "feat(feedback): add 'Send Feedback' to command palette"
```

---

### Task 9: Feature README

**Files:**

- Create: `src/features/feedback/README.md`

**Step 1: Write README**

```markdown
# Feedback Feature

Collects product feedback from users and creates GitHub Issues automatically.

## Entry Points

- **Header button** — "Feedback" button with speech-bubble icon
- **Command palette** — `Cmd+K` → "Send Feedback"

## Components

- `FeedbackModal` — Form modal (lazy-loaded via `lazyWithRetry`)

## Hooks

- `useFeedbackSubmit` — Form state, client validation, API submission

## API

- `POST /api/feedback` — Validates, rate-limits, creates GitHub Issue
- Env: `GITHUB_FEEDBACK_TOKEN` (fine-grained PAT, `issues: write`)

## Form Fields

| Field           | Required | Notes                              |
| --------------- | -------- | ---------------------------------- |
| Category        | Yes      | Feature Request / Bug / General    |
| Title           | Yes      | Max 100 chars                      |
| Description     | Yes      | Max 2000 chars                     |
| Email           | No       | For follow-up only                 |
| Include context | No       | Drawer size, bins, browser, locale |

## Spam Prevention

- Rate limit: 5/hour per IP (Redis sliding window)
- Hidden honeypot field
```

**Step 2: Commit**

```bash
git add src/features/feedback/README.md
git commit -m "docs(feedback): add feature README"
```

---

### Task 10: Final Verification

**Step 1: Run full test suite**

Run: `npm run test:run`
Expected: All tests pass (including new feedback tests).

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors.

**Step 4: Run i18n check**

Run: `npm run check:i18n`
Expected: All locale files match.

**Step 5: Run build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 6: Commit any lint/format fixes if needed**

```bash
git add -A
git commit -m "chore(feedback): fix lint/format issues"
```

---

Plan complete and saved to `docs/plans/2026-02-12-feedback-feature-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?
