/** What a click on the photo does. */
export type TraceMode = 'tap' | 'region' | 'ruler' | 'paper';

/** How many points each marking mode takes. */
export const MARKS_NEEDED = { ruler: 2, paper: 4 } as const;
