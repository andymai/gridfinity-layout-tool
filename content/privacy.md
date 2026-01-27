---
title: Privacy Policy
description: Privacy Policy for Gridfinity Layout Tool. Learn how we collect, use, and protect your data.
keywords: privacy policy, data collection, analytics, gridfinity layout tool
schema: Article
---

# Privacy Policy

**Last updated:** January 2025

Gridfinity Layout Tool is a free, open-source web application maintained by Andy Aragon. This policy explains what data we collect and how we use it.

## Summary

- We collect **anonymous analytics** to improve the app (you can opt out)
- Layouts you create are stored **locally in your browser** unless you choose to share them
- When you share a layout, it's stored on our servers with a shareable link
- We don't sell your data or use it for advertising

## Data We Collect

### Analytics (Optional)

We use [PostHog](https://posthog.com) to understand how people use the app. This helps us prioritize features and fix bugs. Analytics data includes:

- Pages visited and features used
- Device type (mobile/tablet/desktop)
- Anonymous usage patterns (drawer sizes, bin counts)
- Errors and performance metrics

**Analytics is optional.** You can disable it in Settings > Privacy > "Help improve this tool."

When analytics is disabled, no data is sent to PostHog.

### Layout Data

**Local storage:** Your layouts are stored in your browser's localStorage. This data never leaves your device unless you explicitly share a layout.

**Shared layouts:** When you create a shareable link, your layout data is uploaded to [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob). Shared layouts include:

- Your drawer configuration (dimensions, grid settings)
- Bin positions, sizes, labels, and notes
- Categories and colors you've created

Shared layouts are accessible to anyone with the link. You can delete a shared layout at any time.

### Real-time Collaboration

When you use the collaboration feature, your presence data (cursor position, anonymous display name) is shared with other participants via [Liveblocks](https://liveblocks.io). This data is only transmitted while you're actively collaborating and is not stored permanently.

## Data We Don't Collect

- Personal information (name, email, address)
- Payment information
- Precise location
- Cookies for advertising or tracking across sites

## Third-Party Services

| Service    | Purpose                 | Privacy Policy                                                             |
| ---------- | ----------------------- | -------------------------------------------------------------------------- |
| PostHog    | Analytics               | [posthog.com/privacy](https://posthog.com/privacy)                         |
| Vercel     | Hosting & storage       | [vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy) |
| Liveblocks | Real-time collaboration | [liveblocks.io/privacy](https://liveblocks.io/privacy)                     |

## Your Rights

You can:

- **Opt out of analytics** in Settings > Privacy
- **Delete your shared layouts** using the share modal
- **Clear all local data** by clearing your browser's site data for this domain

## Data Retention

- **Local data:** Stored indefinitely until you clear it
- **Shared layouts:** Stored until you delete them (or we may remove inactive shares after 12 months)
- **Analytics:** Retained by PostHog per their data retention policy

## Children's Privacy

This app is not directed at children under 13. We don't knowingly collect data from children.

## Changes to This Policy

We may update this policy occasionally. Significant changes will be noted in the app's changelog.

## Contact

Questions or concerns? Open an issue on our [GitHub repository](https://github.com/andymai/gridfinity-layout-tool/issues).

---

[CTA: Back to the app](/)
