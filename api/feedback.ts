import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit.js';
import { generateText, Output } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';

const GITHUB_REPO = 'andymai/gridfinity-layout-tool';

const CATEGORY_ISSUE_LABELS: Record<string, string> = {
  feature_request: 'feedback: feature',
  bug_report: 'feedback: bug',
  general: 'feedback: general',
};

const VALID_CATEGORIES = new Set(['feature_request', 'bug_report', 'general']);

const CATEGORY_MAP: Record<string, 'bug' | 'feature' | 'general'> = {
  feature_request: 'feature',
  bug_report: 'bug',
  general: 'general',
};

const ENRICHED_CATEGORY_TO_LABEL: Record<string, string> = {
  feature: 'feedback: feature',
  bug: 'feedback: bug',
  general: 'feedback: general',
};

const FeedbackEnrichmentSchema = z.object({
  title: z.string().max(80),
  summary: z.string().max(200),
  category: z.enum(['bug', 'feature', 'general']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  structuredBody: z.string().max(3000),
  duplicateOf: z.number().nullable(),
});

type FeedbackEnrichment = z.infer<typeof FeedbackEnrichmentSchema>;

function sanitizeForPrompt(text: string, maxLength: number): string {
  return text
    .replace(/[^\w\s\-.,!?:;'"&()#×x/@+]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)
    .trim();
}

function sanitizeForMarkdown(text: string): string {
  return text.replace(/[[\]()\\<>&]/g, '\\$&');
}

/** Escape backticks to prevent code fence breakout in markdown. */
function escapeCodeFence(text: string): string {
  return text.replace(/[`\\]/g, '\\$&');
}

/** Strip @mentions and bare URLs from LLM-generated markdown body. */
function sanitizeLlmBody(text: string): string {
  return (
    text
      // Strip @mentions (GitHub would ping users)
      .replace(/@(\w+)/g, '＠$1')
      // Strip bare URLs outside markdown links (potential phishing)
      .replace(/(?<!\()https?:\/\/[^\s)]+/g, '[link removed]')
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

interface RecentIssue {
  number: number;
  title: string;
}

async function fetchRecentFeedbackIssues(token: string): Promise<RecentIssue[]> {
  try {
    const labels = ['feedback: feature', 'feedback: bug', 'feedback: general']
      .map((l) => encodeURIComponent(l))
      .join(',');
    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues?state=open&labels=${labels}&per_page=20&sort=created&direction=desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter(
        (issue: unknown): issue is { number: number; title: string } =>
          typeof issue === 'object' &&
          issue !== null &&
          'number' in issue &&
          'title' in issue &&
          typeof (issue as Record<string, unknown>).number === 'number' &&
          typeof (issue as Record<string, unknown>).title === 'string'
      )
      .map((issue) => ({ number: issue.number, title: issue.title }));
  } catch {
    return [];
  }
}

function buildEnrichmentPrompt(
  description: string,
  userCategory: string,
  context: Record<string, unknown> | undefined,
  recentIssues: RecentIssue[]
): string {
  const categoryInstructions: Record<string, string> = {
    bug: 'Format structuredBody as: ## Steps to Reproduce\\n\\n[steps]\\n\\n## Expected Behavior\\n\\n[expected]\\n\\n## Actual Behavior\\n\\n[actual]',
    feature:
      'Format structuredBody as: ## Use Case\\n\\n[why the user needs this]\\n\\n## Proposal\\n\\n[what they want]',
    general: 'Format structuredBody as: ## Details\\n\\n[organized feedback details]',
  };

  const enrichedCategory = CATEGORY_MAP[userCategory] ?? 'general';

  let prompt = `Analyze this user feedback and produce structured output.

<user_feedback category="${userCategory}">
${sanitizeForPrompt(description, 500)}
</user_feedback>`;

  if (context) {
    prompt += `\n\nLayout context:\n${sanitizeForPrompt(JSON.stringify(context, null, 2), 300)}`;
  }

  if (recentIssues.length > 0) {
    prompt += '\n\nRecent open issues (check for duplicates):';
    for (const issue of recentIssues) {
      prompt += `\n- #${String(issue.number)}: ${sanitizeForPrompt(issue.title, 100)}`;
    }
    prompt +=
      '\n\nSet duplicateOf to the issue number if this is clearly a duplicate, otherwise null.';
  } else {
    prompt += '\n\nNo recent issues to check for duplicates. Set duplicateOf to null.';
  }

  prompt += `\n\nInstructions:
- title: concise issue title, max 80 chars
- summary: one-sentence summary, max 200 chars
- category: classify as bug, feature, or general (may differ from user's selection)
- priority: assess as low, medium, high, or critical
- ${categoryInstructions[enrichedCategory] ?? categoryInstructions.general}
- structuredBody MUST end with: ## Original Description\\n\\n> [paste the user's raw text as a blockquote]`;

  return prompt;
}

interface EnrichmentResult {
  title: string;
  body: string;
  categoryLabel: string;
  labels: string[];
}

async function enrichFeedback(
  description: string,
  userCategory: string,
  email: string | undefined,
  context: Record<string, unknown> | undefined,
  recentIssues: RecentIssue[]
): Promise<EnrichmentResult> {
  try {
    const prompt = buildEnrichmentPrompt(description, userCategory, context, recentIssues);

    const result = await generateText({
      model: gateway('openai/gpt-4o-mini'),
      output: Output.object({
        schema: FeedbackEnrichmentSchema,
      }),
      prompt,
      maxOutputTokens: 500,
      temperature: 0.3,
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety: LLM may return no output
    if (!result.output) {
      throw new Error('LLM returned no structured output');
    }

    const enrichment: FeedbackEnrichment = result.output;

    // Build issue body
    let body = sanitizeLlmBody(enrichment.structuredBody);

    const enrichedCategory = enrichment.category;
    const userEnrichedCategory = CATEGORY_MAP[userCategory] ?? 'general';
    if (enrichedCategory !== userEnrichedCategory) {
      body += `\n\n> **Note:** User selected "${userCategory}" but LLM classified as "${enrichedCategory}".`;
    }

    if (context) {
      body += '\n\n<details><summary>Layout Context</summary>\n\n```json\n';
      body += escapeCodeFence(JSON.stringify(context, null, 2));
      body += '\n```\n\n</details>';
    }

    if (email) {
      body += `\n\n<details><summary>Contact</summary>\n\n${sanitizeForMarkdown(email)}\n\n</details>`;
    }

    if (enrichment.duplicateOf !== null) {
      body += `\n\n---\n\n**Possible duplicate of #${String(enrichment.duplicateOf)}**`;
    }

    const categoryLabel = ENRICHED_CATEGORY_TO_LABEL[enrichedCategory] ?? 'feedback: general';
    const labels: string[] = [categoryLabel, `priority: ${enrichment.priority}`];
    if (enrichment.duplicateOf !== null) {
      labels.push('possible duplicate');
    }

    return {
      title: enrichment.title,
      body,
      categoryLabel: enrichedCategory.charAt(0).toUpperCase() + enrichedCategory.slice(1),
      labels,
    };
  } catch (error) {
    console.error('[Feedback] Enrichment failed, using fallback:', error);

    // Fallback: first sentence as title, raw body
    const fallbackTitle = description.split(/[.\n]/)[0].slice(0, 80) || 'User Feedback';
    const categoryLabel = CATEGORY_ISSUE_LABELS[userCategory] ?? 'feedback: general';

    let body = sanitizeLlmBody(description);
    if (context) {
      body += '\n\n<details><summary>Layout Context</summary>\n\n```json\n';
      body += escapeCodeFence(JSON.stringify(context, null, 2));
      body += '\n```\n\n</details>';
    }
    if (email) {
      body += `\n\n<details><summary>Contact</summary>\n\n${sanitizeForMarkdown(email)}\n\n</details>`;
    }

    return {
      title: fallbackTitle,
      body,
      categoryLabel: categoryLabel.replace('feedback: ', '').replace(/^\w/, (c) => c.toUpperCase()),
      labels: [categoryLabel],
    };
  }
}

const ALLOWED_ORIGINS = new Set([
  'https://gridfinitylayouttool.com',
  'https://www.gridfinitylayouttool.com',
  'https://gridfinity-layout-tool.vercel.app',
]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow Vercel preview deployments
  return /^https:\/\/gridfinity-layout-tool[a-z0-9-]*\.vercel\.app$/.test(origin);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
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

    const { category, description, email, context, hp } = req.body as Record<string, unknown>;

    // Honeypot check
    if (typeof hp === 'string' && hp.length > 0) {
      return res.status(200).json({ success: true });
    }

    if (typeof category !== 'string' || !VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'Invalid category' });
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

    const trimmedDescription = description.trim();
    const validEmail = typeof email === 'string' ? email : undefined;
    const validContext =
      typeof context === 'object' && context !== null
        ? (context as Record<string, unknown>)
        : undefined;

    if (validContext) {
      const contextStr = JSON.stringify(validContext);
      if (contextStr.length > 5000) {
        return res.status(400).json({ error: 'Context too large' });
      }
    }

    const recentIssues = await fetchRecentFeedbackIssues(token);
    const enriched = await enrichFeedback(
      trimmedDescription,
      category,
      validEmail,
      validContext,
      recentIssues
    );

    const issueTitle = `[Feedback] ${enriched.categoryLabel}: ${enriched.title}`;

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
        body: enriched.body,
        labels: enriched.labels,
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
