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

- `POST /api/feedback` — Validates, rate-limits, auto-generates title via LLM, creates GitHub Issue
- Env: `GITHUB_FEEDBACK_TOKEN` (fine-grained PAT, `issues: write`)

## Form Fields

| Field           | Required | Notes                              |
| --------------- | -------- | ---------------------------------- |
| Category        | Yes      | Feature Request / Bug / General    |
| Description     | Yes      | Max 2000 chars                     |
| Email           | No       | For follow-up only                 |
| Include context | No       | Drawer size, bins, browser, locale |

## Spam Prevention

- Rate limit: 5/hour per IP (Redis sliding window)
- Hidden honeypot field
