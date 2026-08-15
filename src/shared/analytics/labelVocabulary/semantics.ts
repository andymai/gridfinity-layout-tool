import type { LabelDomain } from './vocabulary';
import { getCanonicalTerms, getTermDomain, processLabel } from './normalize';

/**
 * Concept / umbrella words (multilingual) that stand for a whole domain rather
 * than a single item. Typing one expands to every catalog term in that domain,
 * so "fasteners" → Screw / Bolt / Nut / Washer / Nail even though no term is
 * literally called "fasteners". Keys are lowercase; accented and unaccented
 * variants are listed separately since the query is lowercased but not folded.
 */
const DOMAIN_CONCEPTS: Record<string, LabelDomain> = {
  tool: 'tools',
  tools: 'tools',
  werkzeug: 'tools',
  werkzeuge: 'tools',
  outil: 'tools',
  outils: 'tools',
  herramienta: 'tools',
  herramientas: 'tools',
  gereedschap: 'tools',
  attrezzi: 'tools',
  utensili: 'tools',
  ferramenta: 'tools',
  ferramentas: 'tools',

  fastener: 'fasteners',
  fasteners: 'fasteners',
  hardware: 'fasteners',
  befestigung: 'fasteners',
  visserie: 'fasteners',
  quincaillerie: 'fasteners',
  tornilleria: 'fasteners',
  tornillería: 'fasteners',
  bevestiging: 'fasteners',
  viteria: 'fasteners',

  electronics: 'electronics',
  electronic: 'electronics',
  components: 'electronics',
  elektronik: 'electronics',
  electronique: 'electronics',
  électronique: 'electronics',
  composants: 'electronics',
  electronica: 'electronics',
  electrónica: 'electronics',
  componentes: 'electronics',
  elettronica: 'electronics',
  componenti: 'electronics',

  office: 'office',
  stationery: 'office',
  büro: 'office',
  buro: 'office',
  bureau: 'office',
  oficina: 'office',
  papeleria: 'office',
  papelería: 'office',
  kantoor: 'office',
  ufficio: 'office',
  cancelleria: 'office',

  craft: 'craft',
  crafts: 'craft',
  crafting: 'craft',
  hobby: 'craft',
  bastel: 'craft',
  basteln: 'craft',
  artisanat: 'craft',
  manualidades: 'craft',
  artesania: 'craft',
  artesanía: 'craft',
  knutselen: 'craft',
  artigianato: 'craft',

  // 3D printing
  printing: 'printing_3d',
  printer: 'printing_3d',
  '3dprinting': 'printing_3d',
  '3d printing': 'printing_3d',
  '3d print': 'printing_3d',
  '3dprint': 'printing_3d',
  druck: 'printing_3d',
  impression: 'printing_3d',
  impresion: 'printing_3d',
  impresión: 'printing_3d',
  stampa: 'printing_3d',

  cosmetics: 'cosmetics',
  cosmetic: 'cosmetics',
  makeup: 'cosmetics',
  kosmetik: 'cosmetics',
  maquillage: 'cosmetics',
  maquillaje: 'cosmetics',
  trucco: 'cosmetics',
  cosmetici: 'cosmetics',
};

/**
 * High-signal cross-domain relations that plain domain grouping misses — a
 * screwdriver (tools) relates to a screw (fasteners), a wrench to a bolt, etc.
 * Directed: `relatedTerms(a)` lists what `a` should also surface.
 */
const RELATED_TERMS: Record<string, string[]> = {
  screwdriver: ['screw', 'bolt'],
  screw: ['screwdriver', 'bolt', 'nut', 'washer'],
  bolt: ['nut', 'washer', 'wrench', 'screw'],
  nut: ['bolt', 'washer', 'wrench'],
  washer: ['bolt', 'nut', 'screw'],
  wrench: ['bolt', 'nut'],
  drill_bit: ['screw'],
  nail: ['hammer'],
  hammer: ['nail'],
  resistor: ['capacitor', 'led', 'wire'],
  capacitor: ['resistor', 'led'],
  led: ['resistor', 'wire'],
  wire: ['led', 'resistor'],
  battery_aa: ['battery_aaa'],
  battery_aaa: ['battery_aa'],
  paint: ['brush'],
  brush: ['paint'],
};

/** The domain a concept/umbrella word stands for, or null. */
export function conceptDomain(query: string): LabelDomain | null {
  return DOMAIN_CONCEPTS[query.toLowerCase().trim()] ?? null;
}

/** Canonical terms directly related to a canonical term (see RELATED_TERMS). */
export function relatedTerms(canonical: string): string[] {
  return RELATED_TERMS[canonical] ?? [];
}

/** All catalog canonical terms in a domain. */
export function termsInDomain(domain: LabelDomain): string[] {
  return getCanonicalTerms().filter((term) => getTermDomain(term) === domain);
}

/**
 * Canonical terms semantically related to a free-text query: the related terms
 * of whatever canonical the query resolves to (exact or strong alias match).
 * The domain-concept expansion is handled separately by `conceptDomain` since
 * it keys off the catalog term's domain rather than a canonical list.
 */
export function relatedTermsForQuery(query: string): string[] {
  const normalized = processLabel(query);
  if (!normalized.normalized || normalized.confidence < 0.8) return [];
  return relatedTerms(normalized.normalized);
}
