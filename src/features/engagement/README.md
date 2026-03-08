# Engagement

Engagement-gated nudge system for feedback, Ko-fi support, and changelog.

## How it works

1. **Engagement tracking** — Reads from existing PostHog analytics data (`gridfinity-analytics-v1`) for feature breadth, plus its own session counter (`gridfinity-nudges-v1`).

2. **Engagement gate** — All three criteria must be met before nudge toasts show:
   - 3+ return sessions
   - 3+ distinct features used
   - 10+ minutes in the current session

3. **Nudge types** — `feedback_rating` (prioritized) and `kofi_support`, each with an independent 30-day cooldown.

4. **Toast delivery** — Uses the existing toast system with action buttons. Non-blocking, dismissible.

5. **Feedback thank-you** — Clicking the feedback link in the header shows a thank-you toast with a Ko-fi mention.

6. **Changelog** — "What's New" tab in the HelpModal. Notification dot on the help button when there are unseen entries. Entries tracked in `changelog.ts`, seen state stored in `gridfinity-changelog-seen`.

## Files

| File                     | Purpose                                                   |
| ------------------------ | --------------------------------------------------------- |
| `engagementTracker.ts`   | Engagement scoring, cooldown management, localStorage I/O |
| `useEngagementNudges.ts` | React hook mounted in App.tsx — checks gate every 60s     |
| `changelog.ts`           | Changelog entries and seen/unseen tracking                |
| `index.ts`               | Public API                                                |
