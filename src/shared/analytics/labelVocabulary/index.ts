export { VOCAB_VERSION } from './vocabulary';
export type { LabelDomain } from './vocabulary';

export {
  clearLabelCache,
  processLabel,
  getCanonicalTerms,
  isKnownTerm,
  getTermDomain,
} from './normalize';
export type { LabelData } from './normalize';
