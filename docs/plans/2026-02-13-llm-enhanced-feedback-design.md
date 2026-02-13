# LLM-Enhanced Feedback Processing Design

**Date:** 2026-02-13
**Status:** Approved

## Goal

Enhance the feedback API endpoint to produce actionable, well-structured GitHub Issues with automatic priority labeling and duplicate detection — all via a single LLM call.

## Current State

`api/feedback.ts` uses `gpt-4o-mini` to generate a title from the user's description. The issue body is the raw description with optional layout context and email in `<details>` blocks. No priority labeling, no duplicate detection, no structured formatting.

## Architecture

Replace `generateTitle()` with `enrichFeedback()` — a single LLM call using `Output.object()` + Zod schema (same pattern as `api/lib/llm.ts` for name suggestions). Before the LLM call, fetch recent open feedback issues from GitHub API to provide duplicate-detection context.

```
User submits → validate → fetch recent issues → enrichFeedback() → create GitHub Issue
```

## LLM Output Schema

```typescript
const FeedbackEnrichment = z.object({
  title: z.string().max(80),
  summary: z.string().max(200),
  category: z.enum(['bug', 'feature', 'general']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  structuredBody: z.string(),
  duplicateOf: z.number().nullable(),
});
```

## Issue Body Format

The LLM generates structured markdown based on category.

**Bug reports:**

```markdown
## Summary

[one-line actionable summary]

## Steps to Reproduce

1. ...

## Expected Behavior

...

## Actual Behavior

...

## Original Description

> [user's raw text]
```

**Feature requests:**

```markdown
## Summary

[one-line actionable summary]

## Use Case

...

## Proposed Solution

...

## Original Description

> [user's raw text]
```

**General feedback:**

```markdown
## Summary

[one-line actionable summary]

## Details

...

## Original Description

> [user's raw text]
```

## Labels

- **Category** (existing): `feedback: feature`, `feedback: bug`, `feedback: general`
- **Priority** (new): `priority: low`, `priority: medium`, `priority: high`, `priority: critical`
- **Duplicate** (new): `possible duplicate` label if LLM detects similarity

## Category Override

User picks a category in the form. LLM also classifies independently. If they differ, use the LLM's classification for labeling (users often miscategorize). Note the user's original selection in the issue body.

## Duplicate Detection

Before the LLM call, fetch the 20 most recent open issues with `feedback:` labels via GitHub API. Pass titles + numbers as context to the LLM prompt. LLM returns `duplicateOf: <issueNumber>` for strong matches, `null` otherwise. If duplicate detected, add `possible duplicate` label and link to the similar issue in the body.

## Prompt Design

Single prompt including:

1. The user's description (first 500 chars)
2. The user's selected category
3. Layout context (if provided)
4. Recent issue titles for duplicate detection
5. Instructions for structured output by category

## Error Handling

If the LLM call fails, fall back to the current behavior: first sentence as title, raw description as body, user's category, no priority label. The feature degrades gracefully.

## Cost & Performance

- **Model:** `gpt-4o-mini` via AI Gateway (same as current)
- **Tokens:** ~200-300 input, ~200 output (structured). ~$0.0002/request.
- **Latency:** ~1-2s for LLM + ~200ms for GitHub issue fetch. Total ~2-3s (acceptable for form submission).
- **Rate limit:** Existing 5/hr feedback rate limit unchanged.

## Files to Modify

- `api/feedback.ts` — Replace `generateTitle()` with `enrichFeedback()`, add GitHub issue fetch, update issue creation with new labels
- No frontend changes needed
