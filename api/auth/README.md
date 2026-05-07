# Auth (`api/auth/`)

OAuth-gated sign-in for the multi-device sync feature. Self-hosted via [Arctic](https://arcticjs.dev/) — no SaaS auth dependency. Cookie sessions stored in Redis. The app stays fully usable anonymously; sign-in only unlocks cross-device sync.

> **Status: not yet user-facing.** The auth surface (endpoints + client session store + SignInButton component) is built and tested, but the UI is gated behind `SYNC_UI_ENABLED` (sourced from `VITE_ENABLE_SYNC_UI`). The gate is **off** in production until the full sync feature lands (target: PR 6). Vite tree-shakes the SignInButton chunk when the gate is false, so the production bundle has zero footprint for this feature today.
>
> To exercise the flow locally: `echo 'VITE_ENABLE_SYNC_UI=1' >> .env.local`.

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

| Var                       | Required   | Purpose                                                                                            |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`        | yes        | Google OAuth app client id                                                                         |
| `GOOGLE_CLIENT_SECRET`    | yes        | Google OAuth app client secret                                                                     |
| `GITHUB_CLIENT_ID`        | yes        | GitHub OAuth app client id                                                                         |
| `GITHUB_CLIENT_SECRET`    | yes        | GitHub OAuth app client secret                                                                     |
| `OAUTH_REDIRECT_BASE_URL` | optional   | Override for the redirect base (e.g. custom domain). Falls back to `getBaseUrl()` (Vercel-derived) |
| `REDIS_URL`               | yes (prod) | Same Redis used by share / rate-limit. Sessions and profiles stored here                           |

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
            → derive userId from sub → upsert profile → mint session → 302 /

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

## User-id derivation

```ts
userId = sha256(`${provider}:${providerSubject}`).slice(0, 32);
```

32 hex chars, stable across re-logins. Pseudonymous: the raw provider subject lives in `users:{uid}:profile` for support/debugging but is never used as a primary key. The hash means a leak of any single index/profile key doesn't reveal which Google account owns it.

## Privacy posture

- The user's email is stored in `users:{uid}:profile` in cleartext. Acceptable for hobby-tool scope. If the privacy bar rises, hash the email at the same boundary as the user id; the trade-off is losing the ability to show "you're signed in as a@example.com" in the UI.
- We never log raw OAuth tokens or `sub` values. The pseudonymous `userId` may appear in error logs.
- Account deletion (PR 3+) is a hard delete: profile, sessions, blobs, indexes — all gone in one cascade.

## Testing

- `auth.test.ts` mocks Arctic + Redis and covers all four endpoints.
- `lib/session.test.ts` and `lib/cookies.test.ts` unit-test the underlying primitives.
- Manual verification flow:
  1. Visit `/api/auth/login/google` in an unauthenticated browser.
  2. Complete the consent screen → land back at `/`.
  3. `GET /api/auth/me` returns `{ userId, provider, email, displayName }`.
  4. `POST /api/auth/logout` (with `X-Requested-With: gflt`) returns 204.
  5. `GET /api/auth/me` returns 401.
