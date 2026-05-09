---
title: Privacy Policy
description: Privacy Policy for Gridfinity Layout Tool. Layouts stay in your browser by default; sign-in is optional. Learn what we collect and how it's used.
keywords: privacy policy, data collection, analytics, gridfinity layout tool
schema: Article
---

# Privacy Policy

**Last updated:** May 2026

Gridfinity Layout Tool is a free, open-source web application maintained by Andy Aragon. This policy explains what data we collect and how we use it.

## Summary

- We collect **anonymous analytics** to improve the app (you can opt out)
- Layouts you create are stored **locally in your browser** unless you choose to share them or sign in
- When you share a layout, it's stored on our servers with a shareable link
- **Sign-in is optional.** If you sign in to sync across devices, we collect your name and email from Google or GitHub
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

We also respect your browser's privacy settings. If your browser sends a [Global Privacy Control](https://globalprivacycontrol.org/) (GPC) or Do Not Track signal, analytics is disabled by default. You can still enable it manually in Settings if you choose.

### Layout Data

**Local storage:** Your layouts are stored locally in your browser. This data never leaves your device unless you explicitly share a layout or sign in for sync.

**Shared layouts:** When you create a shareable link, your layout data is uploaded to [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob). Shared layouts include:

- Your drawer configuration (dimensions, grid settings)
- Bin positions, sizes, labels, and notes
- Categories and colors you've created

Shared layouts are accessible to anyone with the link. You can delete a shared layout at any time.

### Real-time Collaboration

When you use the collaboration feature, your presence data (cursor position and display name) is shared with other participants via [Liveblocks](https://liveblocks.io). The display name is the author name you set in library settings, or an auto-generated guest name if you haven't set one. This data is only transmitted while you're actively collaborating and is not stored permanently.

### Sign-in and Multi-Device Sync (Optional)

The app is fully usable without an account. If you choose to sign in — currently behind the **Cloud Sync** opt-in in Labs settings — we use Google or GitHub as the identity provider and collect:

- A **stable account identifier** issued by the provider (so we can recognize you on return visits without storing a password)
- Your **email address** (must be verified by the provider)
- Your **display name** (shown as your account label in-app)

We do **not** receive or store your password, contacts, calendar, files, or any other data from your Google or GitHub account. The only OAuth scopes requested are:

- **Google:** `openid`, `profile`, `email`
- **GitHub:** `read:user`, `user:email`

We use this information solely to:

- Identify your account so we can return your synced layouts and bin designs to you on any device
- Display your name in the in-app account UI

We do not use your email for marketing and do not share your account information with third parties.

#### Synced layouts and designs

When you're signed in, layouts and bin designs you create are uploaded to our [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) storage under per-account paths that aren't listed publicly. Reads and writes go through our authenticated server endpoints, which check your session cookie before returning data — clients don't access blob URLs directly. Per-account limits currently apply: up to 100 layouts and 100 bin designs, with each layout up to 500 KB, each design up to 100 KB, and 10 MB total per kind.

#### Authentication cookies

| Cookie                                        | Purpose                    | Lifetime   |
| --------------------------------------------- | -------------------------- | ---------- |
| `__Host-gflt_session` (`gflt_session` in dev) | Opaque session token       | 30 days    |
| `gflt_oauth_state`, `gflt_oauth_verifier`     | CSRF / PKCE during sign-in | 10 minutes |

All of these cookies are `HttpOnly` and `SameSite=Lax`, and `Secure` over HTTPS. We do not set advertising or cross-site tracking cookies.

#### Deleting your account

You can delete your account at any time from **Settings > Account > Delete account**. This irreversibly:

1. Signs you out on every device
2. Deletes every synced layout and bin design from our servers
3. Deletes your account profile from our servers

Local data in your browser is unaffected — your locally-stored layouts remain on your device.

## Data We Don't Collect

- Payment information
- Precise location
- Contacts, calendar, files, or anything outside the OAuth scopes listed above
- Cookies for advertising or tracking across sites
- Personal information (name, email) **unless you sign in for cloud sync**

## Third-Party Services

| Service    | Purpose                                | Privacy Policy                                                                                                                                                         |
| ---------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostHog    | Analytics                              | [posthog.com/privacy](https://posthog.com/privacy)                                                                                                                     |
| Vercel     | Hosting & storage                      | [vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy)                                                                                             |
| Liveblocks | Real-time collaboration                | [liveblocks.io/privacy](https://liveblocks.io/privacy)                                                                                                                 |
| Google     | Sign-in for sync (only if you sign in) | [policies.google.com/privacy](https://policies.google.com/privacy)                                                                                                     |
| GitHub     | Sign-in for sync (only if you sign in) | [docs.github.com/site-policy/privacy-policies/github-general-privacy-statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) |

## Your Rights

You can:

- **Opt out of analytics** in Settings > Privacy
- **Use your browser's privacy setting** (Global Privacy Control or Do Not Track) to disable analytics automatically
- **Delete your shared layouts** using the share modal
- **Sign out** from Settings > Account at any time
- **Delete your account** (and all synced data) from Settings > Account > Delete account
- **Clear all local data** by clearing your browser's site data for this domain

## Data Retention

- **Local data:** Stored indefinitely until you clear it
- **Shared layouts:** Stored until you delete them (or we may remove inactive shares after 12 months)
- **Analytics:** Retained by PostHog per their data retention policy
- **Account session cookies:** 30 days from sign-in
- **Account profile (name, email, provider account ID):** 1 year, refreshed on every sign-in. Profiles for accounts that don't sign in for a year are automatically deleted
- **Synced layouts and designs:** Retained until you delete them, or until you delete your account

## Children's Privacy

This app is not directed at children under 13. We don't knowingly collect data from children.

## Changes to This Policy

We may update this policy occasionally. Significant changes will be noted in our [GitHub releases](https://github.com/andymai/gridfinity-layout-tool/releases).

## Contact

Questions or concerns? Open an issue on our [GitHub repository](https://github.com/andymai/gridfinity-layout-tool/issues).

---

[CTA: Back to the app](/)
