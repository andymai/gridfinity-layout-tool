/** Shared metadata returned by section hooks for display in headers/summaries. */
export interface SectionMeta {
  readonly summary: string | undefined;
  readonly disabledReason?: string;
}
