# Auth (`api/auth/`)

OAuth-gated sign-in for the multi-device sync feature. Self-hosted via [Arctic](https://arcticjs.dev/) — no SaaS auth dependency. Cookie sessions stored in Redis. The app stays fully usable anonymously; sign-in only unlocks cross-device sync.

> **Local setup.** Sign-in is surfaced through `UserDock`; there is no build-time or Labs gate. To exercise the flow locally, set the provider credentials plus `OAUTH_REDIRECT_BASE_URL` in `.env.local` — see [Provider setup](#provider-setup) below.

## Endpoints

| Endpoint                        | Method | Auth | Purpose                                     |
| ------------------------------- | ------ | ---- | ------------------------------------------- |
| `/api/auth/login/[provider]`    | GET    | none | 302 to OAuth provider; sets state + PKCE    |
| `/api/auth/callback/[provider]` | GET    | none | Code exchange + session mint; 302 to `/`    |
| `/api/auth/logout`              | POST   | any  | Idempotent: clears session cookie + KV row  |
| `/api/auth/me`                  | GET    | yes  | Returns the signed-in user's public profile |

`provider` is `google` or `github`. Apple, magic-link email, etc. are deliberately out of scope for v1.

## Provider setup

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **Create OAuth client ID** → Application type: Web application.
2. Authorized redirect URIs: `${OAUTH_REDIRECT_BASE_URL}/api/auth/callback/google` — for local dev typically `http://localhost:5173/api/auth/callback/google`, plus the Vercel preview/production URLs.
3. Copy the client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. The OAuth consent screen needs `openid`, `profile`, `email` scopes. Until verified by Google, only listed test users can sign in.

### GitHub

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**.
2. Authorization callback URL: `${OAUTH_REDIRECT_BASE_URL}/api/auth/callback/github`.
3. Copy client ID, generate a new client secret, store as `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
4. Scopes used: `read:user`, `user:email`. The endpoint falls back to `/user/emails` if the user has hidden their primary email on the public profile.

## Environment variables

| Var                       | Required   | Purpose                                                                                                                                                                                                          |
| ------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`        | yes        | Google OAuth app client id                                                                                                                                                                                       |
| `GOOGLE_CLIENT_SECRET`    | yes        | Google OAuth app client secret                                                                                                                                                                                   |
| `GITHUB_CLIENT_ID`        | yes        | GitHub OAuth app client id                                                                                                                                                                                       |
| `GITHUB_CLIENT_SECRET`    | yes        | GitHub OAuth app client secret                                                                                                                                                                                   |
| `OAUTH_REDIRECT_BASE_URL` | local dev  | Override for the redirect base (e.g. custom domain). Falls back to `getBaseUrl()`, which is Vercel-derived in deployments but `https://localhost:3000` elsewhere — so local dev must set this to the Vite origin |
| `REDIS_URL`               | yes (prod) | Same Redis used by share / rate-limit. Sessions and profiles stored here                                                                                                                                         |

## Cookie shape

| Cookie                                              | TTL     | Purpose                             |
| --------------------------------------------------- | ------- | ----------------------------------- |
| `__Host-gflt_session` (prod) / `gflt_session` (dev) | 30 days | Opaque session token; KV-validated  |
| `gflt_oauth_state`                                  | 10 min  | CSRF token for the OAuth round-trip |
| `gflt_oauth_verifier`                               | 10 min  | PKCE verifier (Google only)         |

All three are `HttpOnly + SameSite=Lax`. The session and OAuth temp cookies are `Secure` in any environment served over HTTPS (Vercel production + preview); plain HTTP local dev drops both `Secure` and the `__Host-` prefix.

## Why no HMAC / signed tokens

The session cookie holds an opaque random 32-byte token (64 hex chars). Verification is by exact-match KV lookup — there's no payload to forge or tamper with: a wrong token simply maps to no record (lookup returns `null` → 401). Adding HMAC signing would be redundant with the `HttpOnly` guarantee and the KV lookup.

The OAuth state cookie works the same way: the server stores no secret on it, just compares the cookie value byte-for-byte to the `state` query param the provider returns. With `HttpOnly`, no client JS can read or write it; with `SameSite=Lax`, no cross-site form-POST can carry it.

## Session lifecycle

```
sign-in:    /login/[p] → state cookie set → 302 to provider
            provider → /callback/[p] → state matches? code → tokens
            → resolve userId via identity map → upsert profile → mint session → 302 /

session:    cookie + KV row, 30-day TTL. Refresh on use is *not* implemented;
            the cookie is replaced on each new sign-in.

profile:    1-year TTL, refreshed on each successful sign-in. Active users
            keep their profile alive; abandoned accounts age out automatically.

create:     SET session:{token} EX 30d  +  SADD users:{uid}:sessions {token}
            issued as one pipeline so a transient failure can't leave a
            session orphaned from the cleanup set.

prune:      Each createSession opportunistically SREMs members of
            users:{uid}:sessions whose underlying session row has expired.
            Best-effort; failures don't block sign-in.

revocation: POST /logout → DEL session:{token}, SREM users:{uid}:sessions {token}
            → cookie cleared. Idempotent (works even with a stale cookie).

cascade:    Account deletion (PR 3+) does SMEMBERS users:{uid}:sessions →
            DEL each session:{token}, then drops users:{uid}:* keys.
```

## Rate limits

Keyed by client IP (hashed). All four endpoints are rate-limited:

| Action          | Endpoints              | Limit        |
| --------------- | ---------------------- | ------------ |
| `auth.start`    | `/login/[provider]`    | 30 / minute  |
| `auth.callback` | `/callback/[provider]` | 30 / minute  |
| `auth.read`     | `/logout`, `/me`       | 100 / minute |

## CSRF defense

Mutating endpoints (`POST /logout`, future sync `PUT/DELETE`) layer three checks:

1. **`SameSite=Lax`** on the session cookie blocks cross-site form-POSTs by default.
2. **Origin / Sec-Fetch-Site** header check rejects cross-site fetches — see `lib/session.ts:checkCsrfDefense`.
3. **`X-Requested-With: gflt`** custom header set by the client `apiFetch`. Cross-origin attackers can't set custom headers without a CORS preflight, which the deployment never grants.

`GET /me` is read-only, so only checks (1) and (2) apply; (3) is enforced for non-safe methods.

## User-id resolution

```ts
identity:{sha256(`${TOKEN_SALT}:identity:${provider}:${providerSubject}`).slice(0, 32)} -> userId
```

The id is a **random** 32-hex value, not a derivation, resolved through that salted map (`lib/userId.ts:resolveUserId`). Stable across re-logins; the raw provider subject lives in `users:{uid}:profile` for support/debugging and is never a primary key.

It used to be `sha256(`${provider}:${providerSubject}`)` with no salt. GitHub's `providerSubject` is a public, sequential, bounded (~2^28) account id, so that whole output space was precomputable: anyone holding one Redis key of these ids (a `community:reports:{id}` set from a backup, say) could match every member against a rainbow table and name the account behind each pseudonymous reporter, liker and publisher. A random id has no input to recover, so it is unreversible even to someone who holds `TOKEN_SALT`.

Both halves matter. The map key must stay salted: an unsalted `sha256(github:N) -> userId` entry rebuilds exactly the join the random id removes.

**Accounts created before the map are adopted, not rotated.** On the first sign-in after deploy, a map miss falls back to the legacy derivation and, if any DURABLE state exists under it, adopts that id — nothing moves, nothing breaks, and the account keeps its layouts and published designs. The probe covers the sync indexes and the published set, not just the profile: the profile has a 1-year TTL while those have none, so a user dormant for over a year has an expired profile and fully intact data, and a profile-only test would sign them into an empty account. Those ids stay reversible, deliberately: `authorPublicId` derives from `userId` and is baked into print-photo Blob paths that are already public URLs, so rotating an existing id means rewriting content already handed out. Closing that residue means pinning `authorPublicId` to a stored value first.

Sign-in now **fails closed without `TOKEN_SALT`** (503) rather than writing an unsalted key, joining community blob paths, print photo paths and `authorPublicId` in depending on that salt — treat it as permanent per deployment.

## Privacy posture

- The user's email is stored in `users:{uid}:profile` in cleartext. Acceptable for hobby-tool scope. If the privacy bar rises, hash the email at the same boundary as the user id; the trade-off is losing the ability to show "you're signed in as a@example.com" in the UI.
- We never log raw OAuth tokens or `sub` values. The pseudonymous `userId` may appear in error logs.
- `ProviderProfile.verifiedEmails` carries every address the provider has verified, but only ever reaches `deriveDonorCandidates`, which reduces it to salted hashes. Those hashes are stored on the profile as `donorCandidates`; the addresses themselves are not persisted beyond the primary the profile already held. See "Supporter recognition" in [`../README.md`](../README.md) for why the match is restricted to provider-verified addresses.
- GitHub's `/user/emails` is fetched on **every** sign-in, not only when `/user` hides the address, because the full verified list is what makes the supporter match work for someone who paid from a different address. Its failure is soft: sign-in still succeeds on `/user`'s address alone.
- Account deletion (PR 3+) is a hard delete: profile, sessions, blobs, indexes — all gone in one cascade.

## Testing

- `auth.test.ts` mocks Arctic + Redis and covers all four endpoints.
- `lib/session.test.ts` and `lib/cookies.test.ts` unit-test the underlying primitives.
- Manual verification flow:
  1. Visit `/api/auth/login/google` in an unauthenticated browser.
  2. Complete the consent screen → land back at `/`.
  3. `GET /api/auth/me` returns `{ userId, provider, email, displayName, handle }`.
  4. `POST /api/auth/logout` (with `X-Requested-With: gflt`) returns 204.
  5. `GET /api/auth/me` returns 200 `{ authenticated: false, user: null }`.
