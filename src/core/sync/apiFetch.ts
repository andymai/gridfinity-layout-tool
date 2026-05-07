/**
 * Authenticated `fetch` wrapper for the sync feature.
 *
 * Adds the two pieces every sync request needs:
 *   - `credentials: 'include'` so the browser sends the session cookie
 *     (the cookie is HttpOnly so JS can't read it; the browser handles it).
 *   - `X-Requested-With: gflt` header so the server's CSRF check passes.
 *     Cross-origin attackers can't set custom headers without a CORS
 *     preflight, which we never grant.
 *
 * On a 401 response we dispatch a `gflt:forced-sign-out` window event so the
 * session store can flip to anonymous without polling. Local data is left
 * alone — if the user didn't ask to be signed out, we don't wipe their work.
 */

export const FORCED_SIGN_OUT_EVENT = 'gflt:forced-sign-out';

let forcedSignOutDispatched = false;

export interface ApiFetchOptions extends RequestInit {
  /** Pass false to skip the X-Requested-With header (e.g. for cross-origin debug). */
  csrf?: boolean;
}

export async function apiFetch(input: string, init: ApiFetchOptions = {}): Promise<Response> {
  const { csrf = true, headers, ...rest } = init;
  const merged = new Headers(headers);
  if (csrf) merged.set('X-Requested-With', 'gflt');

  const response = await fetch(input, {
    ...rest,
    credentials: 'include',
    headers: merged,
  });

  if (response.status === 401 && !forcedSignOutDispatched) {
    forcedSignOutDispatched = true;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FORCED_SIGN_OUT_EVENT));
    }
    // Allow another forced sign-out to fire after the session store has had
    // a chance to react (next tick).
    queueMicrotask(() => {
      forcedSignOutDispatched = false;
    });
  }

  return response;
}
