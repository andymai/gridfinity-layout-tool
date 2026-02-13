import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit';
import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';

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

async function generateTitle(description: string, category: string): Promise<string> {
  try {
    const result = await generateText({
      model: gateway('openai/gpt-4o-mini'),
      prompt: `Write a concise issue title (max 80 chars) for this ${CATEGORY_LABELS[category] ?? 'feedback'}:\n\n${description.slice(0, 500)}`,
      maxOutputTokens: 30,
      temperature: 0.3,
    });
    const title = result.text.trim().replace(/^["']|["']$/g, '');
    return title || description.slice(0, 80);
  } catch {
    // Fallback: use first line/sentence of description
    return description.split(/[.\n]/)[0].slice(0, 80) || 'User Feedback';
  }
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
    const { category, description, email, context } = body;

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

    // Auto-generate title from description using LLM
    const title = await generateTitle(description.trim(), category);
    const issueTitle = `[Feedback] ${CATEGORY_LABELS[category]}: ${title}`;
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
