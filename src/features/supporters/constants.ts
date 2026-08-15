/**
 * Client mirrors of the supporter text caps.
 *
 * KEEP IN LOCKSTEP with `MAX_DISPLAY_NAME_LENGTH` / `MAX_MESSAGE_LENGTH` in
 * `api/lib/supporters.ts`. The server is the authority — it truncates and
 * content-filters every write regardless of what arrives — so a drift here
 * costs a confusing edit (typing past a limit that silently trims), never a
 * bypass. The client can't import from `api/`, hence the duplication.
 */

/** Ko-fi allows long names; the tape texture wraps but can't absorb an essay. */
export const MAX_DISPLAY_NAME_LENGTH = 32;

/** A supporter message shows on a bin's tape card; keep it to a glanceable line. */
export const MAX_MESSAGE_LENGTH = 140;
