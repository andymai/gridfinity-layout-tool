import { useLidSection } from '../panel/LidSection/useLidSection';

/** Read-only summary for the Lid group when collapsed. Mirrors the value
 *  summary shown inside the section (attachment mode + top-surface hint) so
 *  the collapsed header still communicates the lid's configuration. Returns
 *  a short "Off" string when the lid is not effectively enabled. */
export function useLidGroupSummary(): string {
  const { state, t } = useLidSection();
  return state.enabled ? state.valueSummary : t('binDesigner.lid.summaryDisabled');
}
