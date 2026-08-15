# Engagement

Engagement-gated nudge system for feedback and Ko-fi support.

## How it works

1. **Engagement tracking** — Reads from existing PostHog analytics data (`gridfinity-analytics-v1`) for feature breadth, plus its own session counter (`gridfinity-nudges-v1`).

2. **Engagement gate** — All four criteria must be met before nudge toasts show:
   - the user has downloaded a printable file this session (`hasConvertedThisSession`)
   - 3+ return sessions
   - 3+ distinct features used
   - 10+ minutes in the current session

   The conversion condition is checked first and short-circuits the rest. An ask
   that arrives mid-task is asking someone to stop doing the thing they came for,
   which is what 1,376 impressions to 11 clicks looked like.

3. **Nudge types** — `feedback_rating` (prioritized) and `kofi_support`, each with an independent 30-day cooldown.

4. **Toast delivery** — Uses the existing toast system with action buttons. Non-blocking, dismissible.

5. **Feedback thank-you** — Clicking the feedback link in the header shows a thank-you toast with a Ko-fi mention.

## Files

| File                     | Purpose                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `engagementTracker.ts`   | Engagement scoring, cooldown management, localStorage I/O                 |
| `useEngagementNudges.ts` | React hook mounted in App.tsx — checks gate every 60s, after a conversion |
| `index.ts`               | Public API                                                                |
