# Feedback Feature Design

**Date:** 2026-02-12
**Status:** Approved

## Goal

Collect product feedback (feature requests, bug reports, general impressions) from users, creating GitHub Issues automatically for triage.

## Entry Point

Header bar button labeled "Feedback" (with speech-bubble icon). Also accessible via command palette (`Cmd+K` → "Send Feedback").

## UI: FeedbackModal

Lazy-loaded modal using the existing `Dialog` compound component pattern (same as `SettingsModal`).

### Form Fields

| Field               | Type         | Required | Constraints                                |
| ------------------- | ------------ | -------- | ------------------------------------------ |
| Category            | Select       | Yes      | `feature_request`, `bug_report`, `general` |
| Title               | Text input   | Yes      | Max 100 chars                              |
| Description         | Textarea     | Yes      | Max 2000 chars                             |
| Email               | Text input   | No       | Email format validation                    |
| Include layout info | Checkbox     | No       | Default unchecked; attaches context        |
| Honeypot            | Hidden input | —        | Must be empty (spam filter)                |

### Context (opt-in)

When "Include layout info" is checked, attaches:

- Drawer dimensions (width x depth x height)
- Bin count, layer count
- Browser user agent
- Half-bin mode enabled
- Current locale

### UX Flow

1. User clicks header "Feedback" button
2. FeedbackModal opens with empty form
3. User fills form, optionally checks "Include layout info"
4. Submit → loading spinner on button
5. Success → modal closes, success toast
6. Error → inline error message, form stays open for retry

## API: `api/feedback.ts`

POST endpoint on Vercel serverless.

### Request

```typescript
{
  category: 'feature_request' | 'bug_report' | 'general';
  title: string;
  description: string;
  email?: string;
  context?: {
    drawerSize: string;
    binCount: number;
    layerCount: number;
    browser: string;
    halfBinMode: boolean;
    locale: string;
  };
  hp?: string; // honeypot
}
```

### Server Logic

1. **Rate limit** — 5 submissions/hour per IP (reuse `api/lib/rateLimit.ts`)
2. **Honeypot** — reject if `hp` is non-empty
3. **Validation** — field lengths, required fields, email format
4. **Create GitHub Issue** via GitHub REST API (`POST /repos/{owner}/{repo}/issues`)
   - Labels: `feedback: feature`, `feedback: bug`, or `feedback: general`
   - Title: `[Feedback] {Category}: {title}`
   - Body: description + collapsible context block + email (if provided)
5. Return `{ success: true }` or `{ error: string }`

### Environment

- `GITHUB_FEEDBACK_TOKEN` — fine-grained PAT, scoped to `issues: write` on the repo

## File Structure

```
src/features/feedback/
├── README.md
├── components/
│   ├── FeedbackModal.tsx
│   └── FeedbackModal.test.tsx
├── hooks/
│   ├── useFeedbackSubmit.ts
│   └── useFeedbackSubmit.test.ts
└── types.ts

api/feedback.ts
```

## i18n

All user-facing strings under `feedback.*` namespace. Added to `en.ts` first, then all locale JSONs (de, es, fr, nb, nl, pt-BR).

## Spam Prevention

- IP-based rate limiting (5/hour) via existing `rateLimit.ts`
- Hidden honeypot field (rejected server-side if filled)
- No CAPTCHA (avoids UX friction)

## Decisions Log

| Decision    | Choice                  | Rationale                                    |
| ----------- | ----------------------- | -------------------------------------------- |
| Entry point | Header bar              | Visible even with sidebar collapsed          |
| Backend     | GitHub Issues           | Directly actionable, no intermediate storage |
| Auth        | Server-side PAT         | Users never interact with GitHub             |
| Context     | Opt-in checkbox         | Respects privacy while enabling debugging    |
| Spam        | Rate limit + honeypot   | Low friction, no third-party deps            |
| Categories  | 3 (feature/bug/general) | Simple to triage, covers main types          |
