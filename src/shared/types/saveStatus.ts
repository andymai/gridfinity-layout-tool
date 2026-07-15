/**
 * Auto-save status, shared by every surface that autosaves a design.
 *
 * Lives in shared rather than a feature because both the bin designer and the
 * baseplate page render the same indicator, and features can't import from each
 * other.
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
