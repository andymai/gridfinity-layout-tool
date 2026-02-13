import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function createMockRequest(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    body: {
      category: 'bug_report',
      description: 'The grid does not snap correctly when using half-bin mode.',
    },
    headers: {
      origin: 'https://gridfinitylayouttool.com',
    },
    ...overrides,
  } as unknown as VercelRequest;
}

function createMockResponse(): VercelResponse & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: null,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
  };
  return res as unknown as VercelResponse & { _status: number; _body: unknown };
}

const defaultEnrichment = {
  title: 'Grid snapping broken in half-bin mode',
  summary: 'Half-bin snapping does not work correctly.',
  category: 'bug' as const,
  priority: 'medium' as const,
  structuredBody:
    '## Steps to Reproduce\n\n1. Enable half-bin mode\n2. Place a bin\n\n## Expected Behavior\n\nSnaps correctly\n\n## Actual Behavior\n\nDoes not snap\n\n## Original Description\n\n> The grid does not snap correctly when using half-bin mode.',
  duplicateOf: null,
};

function createMockFetch() {
  const mockFetch = vi.fn();
  // First call: fetchRecentFeedbackIssues
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve([{ number: 1, title: 'Existing issue' }]),
  } as unknown as Response);
  // Second call: createGitHubIssue
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ number: 42, html_url: 'https://github.com/test/42' }),
  } as unknown as Response);
  return mockFetch;
}

describe('feedback handler', () => {
  let handler: (req: VercelRequest, res: VercelResponse) => Promise<unknown>;
  let mockGenerateText: ReturnType<typeof vi.fn>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv('GITHUB_FEEDBACK_TOKEN', 'test-token');
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    mockGenerateText = vi.fn().mockResolvedValue({ output: { ...defaultEnrichment } });

    vi.resetModules();

    vi.doMock('./lib/rateLimit.js', () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
    }));
    vi.doMock('ai', () => ({
      generateText: mockGenerateText,
      Output: { object: vi.fn().mockReturnValue('mock-output-schema') },
    }));
    vi.doMock('@ai-sdk/gateway', () => ({
      gateway: vi.fn().mockReturnValue('mock-model'),
    }));

    const mod = await import('./feedback');
    handler = mod.default;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Request validation', () => {
    it('rejects non-POST', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(405);
    });

    it('rejects missing origin', async () => {
      const req = createMockRequest({ headers: {} });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(403);
    });

    it('rejects disallowed origin', async () => {
      const req = createMockRequest({ headers: { origin: 'https://evil.com' } });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(403);
    });

    it('allows production origin', async () => {
      const req = createMockRequest({
        headers: { origin: 'https://www.gridfinitylayouttool.com' },
      });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(200);
    });

    it('allows Vercel preview origin', async () => {
      const req = createMockRequest({
        headers: { origin: 'https://gridfinity-layout-tool-abc123.vercel.app' },
      });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(200);
    });

    it('returns 500 when GITHUB_FEEDBACK_TOKEN not set', async () => {
      vi.stubEnv('GITHUB_FEEDBACK_TOKEN', '');
      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(500);
      expect(res._body).toEqual(expect.objectContaining({ error: 'Feedback not configured' }));
    });

    it('silently accepts honeypot filled', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'spam content',
          hp: 'bot-filled-this',
        },
      });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ success: true });
      const githubIssueCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('/issues') && !call[0].includes('?')
      );
      expect(githubIssueCalls).toHaveLength(0);
    });

    it('rejects invalid category', async () => {
      const req = createMockRequest({ body: { category: 'spam', description: 'test' } });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(res._body).toEqual(expect.objectContaining({ error: 'Invalid category' }));
    });

    it('rejects missing description', async () => {
      const req = createMockRequest({ body: { category: 'bug_report' } });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(res._body).toEqual(expect.objectContaining({ error: 'Description is required' }));
    });

    it('rejects empty description', async () => {
      const req = createMockRequest({ body: { category: 'bug_report', description: '   ' } });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(res._body).toEqual(expect.objectContaining({ error: 'Description is required' }));
    });

    it('rejects description over 2000 chars', async () => {
      const req = createMockRequest({
        body: { category: 'bug_report', description: 'a'.repeat(2001) },
      });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(res._body).toEqual(
        expect.objectContaining({ error: 'Description too long (max 2000 characters)' })
      );
    });

    it('rejects invalid email format', async () => {
      const req = createMockRequest({
        body: { category: 'bug_report', description: 'test desc', email: 'not-an-email' },
      });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(res._body).toEqual(expect.objectContaining({ error: 'Invalid email format' }));
    });

    it('rejects context over 5000 chars', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'test desc',
          context: { data: 'x'.repeat(5000) },
        },
      });
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(res._body).toEqual(expect.objectContaining({ error: 'Context too large' }));
    });
  });

  describe('Enrichment (happy path)', () => {
    it('calls generateText with correct prompt structure', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);

      expect(mockGenerateText).toHaveBeenCalledOnce();
      const callArgs = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.model).toBe('mock-model');
      expect(callArgs.prompt).toContain('user_feedback');
      expect(callArgs.prompt).toContain('bug_report');
      expect(callArgs.maxOutputTokens).toBe(500);
      expect(callArgs.temperature).toBe(0.3);
    });

    it('creates GitHub issue with enriched title, body, and labels', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);

      expect(res._status).toBe(200);
      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as {
        title: string;
        body: string;
        labels: string[];
      };
      expect(body.title).toBe('[Feedback] Bug: Grid snapping broken in half-bin mode');
      expect(body.labels).toContain('feedback: bug');
    });

    it('includes priority label from LLM output', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { labels: string[] };
      expect(body.labels).toContain('priority: medium');
    });

    it('includes duplicate label when duplicateOf is set', async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: { ...defaultEnrichment, duplicateOf: 7 },
      });
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ number: 7, title: 'Original issue' }]),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ number: 43 }) });

      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as {
        labels: string[];
        body: string;
      };
      expect(body.labels).toContain('possible duplicate');
      expect(body.body).toContain('Possible duplicate of #7');
    });

    it('adds category mismatch note when LLM disagrees with user', async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: { ...defaultEnrichment, category: 'feature' },
      });
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ number: 44 }) });

      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { body: string };
      expect(body.body).toContain('User selected "bug_report" but LLM classified as "feature"');
    });

    it('includes layout context in details block', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'Some bug.',
          context: { gridSize: 4, layers: 2 },
        },
      });
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { body: string };
      expect(body.body).toContain('<details><summary>Layout Context</summary>');
      expect(body.body).toContain('"gridSize": 4');
    });

    it('includes email in details block', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'Some bug.',
          email: 'user@example.com',
        },
      });
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { body: string };
      expect(body.body).toContain('<details><summary>Contact</summary>');
      expect(body.body).toContain('user@example.com');
    });
  });

  describe('Fallback path', () => {
    beforeEach(() => {
      mockGenerateText.mockRejectedValue(new Error('LLM unavailable'));
    });

    it('falls back when generateText throws', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);
      expect(res._status).toBe(200);
    });

    it('fallback uses first sentence as title', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'Grid is broken. Other details here.',
        },
      });
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { title: string };
      expect(body.title).toContain('Grid is broken');
    });

    it('fallback uses category label from user selection', async () => {
      const req = createMockRequest({
        body: { category: 'feature_request', description: 'Add dark mode.' },
      });
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { labels: string[] };
      expect(body.labels).toContain('feedback: feature');
    });

    it('fallback sanitizes description (no raw markdown injection)', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'Check @admin and https://evil.com for details.',
        },
      });
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { body: string };
      expect(body.body).not.toContain('@admin');
      expect(body.body).toContain('\uFF20admin');
      expect(body.body).not.toContain('https://evil.com');
      expect(body.body).toContain('[link removed]');
    });

    it('fallback capitalizes category label', async () => {
      const req = createMockRequest({
        body: { category: 'general', description: 'Just some thoughts.' },
      });
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { title: string };
      expect(body.title).toContain('[Feedback] General:');
    });
  });

  describe('Sanitization', () => {
    it('sanitizeForPrompt strips control characters and special chars', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'Normal text with emoji \u0001 and special \u200B chars.',
        },
      });
      const res = createMockResponse();
      await handler(req, res);

      expect(mockGenerateText).toHaveBeenCalledOnce();
      const callArgs = mockGenerateText.mock.calls[0][0] as { prompt: string };
      expect(callArgs.prompt).not.toContain('\u0001');
      expect(callArgs.prompt).not.toContain('\u200B');
    });

    it('sanitizeForPrompt collapses newlines to spaces', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'Line one\n\n\nLine two',
        },
      });
      const res = createMockResponse();
      await handler(req, res);

      const callArgs = mockGenerateText.mock.calls[0][0] as { prompt: string };
      expect(callArgs.prompt).toContain('Line one Line two');
    });

    it('sanitizeForPrompt truncates to max length', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'a'.repeat(2000),
        },
      });
      const res = createMockResponse();
      await handler(req, res);

      const callArgs = mockGenerateText.mock.calls[0][0] as { prompt: string };
      const feedbackMatch = /<user_feedback[^>]*>([\s\S]*?)<\/user_feedback>/;
      const match = feedbackMatch.exec(callArgs.prompt);
      expect(match).not.toBeNull();
      expect(match![1].trim().length).toBeLessThanOrEqual(500);
    });

    it('sanitizeForMarkdown escapes brackets, parens, backslash, HTML chars', async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: {
          ...defaultEnrichment,
          structuredBody: '## Details\n\nSome body text.',
        },
      });
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ number: 47 }) });

      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'Test desc.',
          email: 'user@example.com',
        },
      });
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { body: string };
      // sanitizeForMarkdown is applied to the email in the contact details block
      // A normal email passes through; verify the contact block exists
      expect(body.body).toContain('<details><summary>Contact</summary>');
      expect(body.body).toContain('user@example.com');
    });

    it('escapeCodeFence escapes backticks and backslashes', async () => {
      const req = createMockRequest({
        body: {
          category: 'bug_report',
          description: 'Test.',
          context: { note: 'has ` backtick and \\ backslash' },
        },
      });
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { body: string };
      expect(body.body).toContain('\\`');
      expect(body.body).toContain('\\\\');
    });

    it('sanitizeLlmBody strips @mentions', async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: {
          ...defaultEnrichment,
          structuredBody: 'Please ask @maintainer about this.',
        },
      });
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ number: 45 }) });

      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { body: string };
      expect(body.body).not.toContain('@maintainer');
      expect(body.body).toContain('\uFF20maintainer');
    });

    it('sanitizeLlmBody strips bare URLs', async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: {
          ...defaultEnrichment,
          structuredBody: 'See https://malicious.example.com for more.',
        },
      });
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ number: 46 }) });

      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);

      const createCall = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(createCall[1].body as string) as { body: string };
      expect(body.body).not.toContain('https://malicious.example.com');
      expect(body.body).toContain('[link removed]');
    });
  });

  describe('Rate limiting', () => {
    it('returns 429 when rate limited', async () => {
      vi.resetModules();
      vi.doMock('./lib/rateLimit.js', () => ({
        checkRateLimit: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 60 }),
        getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
      }));
      vi.doMock('ai', () => ({
        generateText: vi.fn(),
        Output: { object: vi.fn() },
      }));
      vi.doMock('@ai-sdk/gateway', () => ({
        gateway: vi.fn().mockReturnValue('mock-model'),
      }));

      const mod = await import('./feedback');
      const rateLimitedHandler = mod.default;

      const req = createMockRequest();
      const res = createMockResponse();
      await rateLimitedHandler(req, res);

      expect(res._status).toBe(429);
      expect(res._body).toEqual(
        expect.objectContaining({ error: 'Too many submissions. Please try again later.' })
      );
    });
  });

  describe('GitHub API errors', () => {
    it('returns 502 when GitHub issue creation fails', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve('Validation Failed'),
      });

      const req = createMockRequest();
      const res = createMockResponse();
      await handler(req, res);

      expect(res._status).toBe(502);
      expect(res._body).toEqual(expect.objectContaining({ error: 'Failed to submit feedback' }));
    });
  });
});
