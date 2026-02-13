/**
 * Core suggestion generation logic.
 *
 * Pure function that analyzes layout data and generates name suggestions.
 * Leverages existing labelVocabulary.ts for domain detection and
 * purposeInference.ts for drawer purpose analysis.
 */

import type {
  SuggestionInput,
  SuggestionResult,
  NameSuggestion,
  SuggestionSource,
  CategoryCount,
} from '../types';
import type { LabelDomain } from '@/shared/analytics/labelVocabulary';
import { processLabel } from '@/shared/analytics/labelVocabulary';
import type { NamingPattern } from './namingData';
import {
  DOMAIN_NAMING,
  PURPOSE_NAMES,
  SUBCATEGORY_PATTERNS,
  SIMPLE_SUFFIXES,
  LOCATION_PATTERNS,
} from './namingData';

// ============================================
// HELPERS
// ============================================

/**
 * Size descriptors based on drawer dimensions.
 * Returns both a descriptor ("Compact", "Large") and an adjective ("Small", "Full-Size").
 */
function getSizeInfo(width: number, depth: number): { descriptor: string; adjective: string } {
  const area = width * depth;

  if (area <= 16) return { descriptor: 'Compact', adjective: 'Small' };
  if (area <= 40) return { descriptor: 'Medium', adjective: 'Standard' };
  if (area <= 80) return { descriptor: 'Large', adjective: 'Full-Size' };
  return { descriptor: 'Extra Large', adjective: 'XL' };
}

/**
 * Quantity-based info for naming suggestions.
 * Returns a prefix for formal names (e.g., "Complete") and standalone casual names.
 */
function getQuantityInfo(binCount: number): { prefix: string | null; casualNames: string[] } {
  if (binCount >= 30) {
    return { prefix: 'Complete', casualNames: ['Everything', 'The Full Set', 'All of It'] };
  }
  if (binCount >= 20) {
    return { prefix: 'Full', casualNames: ['Well Stocked', 'Fully Loaded', 'The Works'] };
  }
  if (binCount >= 15) {
    return { prefix: 'Comprehensive', casualNames: ['Lots of Stuff'] };
  }
  if (binCount >= 10) {
    return { prefix: 'Standard', casualNames: ['Various Things'] };
  }
  if (binCount <= 5 && binCount > 0) {
    return { prefix: 'Starter', casualNames: ['The Basics', 'Essentials', 'Just What I Need'] };
  }
  return { prefix: null, casualNames: [] };
}

/**
 * Get a deterministic "random" creative name based on input hash.
 * Uses label count as a simple seed for variety.
 */
function pickCreativeName(names: string[], seed: number): string {
  return names[seed % names.length];
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Result of analyzing labels for domains.
 */
interface DomainAnalysis {
  /** Most common domain */
  primaryDomain: LabelDomain | null;
  /** Second most common domain (if significant) */
  secondaryDomain: LabelDomain | null;
  /** Concentration of primary domain (0-1) */
  concentration: number;
  /** Number of labels analyzed */
  totalLabels: number;
  /** Normalized terms found (for specific naming) */
  normalizedTerms: string[];
}

/**
 * Result of detecting subcategories.
 */
interface SubcategoryMatch {
  /** Suggested names from the subcategory */
  names: string[];
  /** Confidence boost */
  confidenceBoost: number;
}

/**
 * Analyze labels to find the dominant domain(s).
 */
function analyzeLabels(labels: string[]): DomainAnalysis {
  const domainCounts = new Map<LabelDomain, number>();
  const normalizedTerms: string[] = [];
  let totalWithDomain = 0;

  for (const label of labels) {
    const processed = processLabel(label);
    if (processed.domain) {
      domainCounts.set(processed.domain, (domainCounts.get(processed.domain) ?? 0) + 1);
      totalWithDomain++;
    }
    if (processed.normalized) {
      normalizedTerms.push(processed.normalized);
    }
  }

  // Sort domains by count
  const sorted = Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1]);

  const primaryDomain = sorted[0]?.[0] ?? null;
  const primaryCount = sorted[0]?.[1] ?? 0;
  const secondaryDomain = sorted[1]?.[0] ?? null;
  const secondaryCount = sorted[1]?.[1] ?? 0;

  // Calculate concentration (how dominant the primary domain is)
  const concentration = totalWithDomain > 0 ? primaryCount / totalWithDomain : 0;

  // Only include secondary if it's at least 20% of total
  const hasSignificantSecondary =
    secondaryCount > 0 && totalWithDomain > 0 && secondaryCount / totalWithDomain >= 0.2;

  return {
    primaryDomain,
    secondaryDomain: hasSignificantSecondary ? secondaryDomain : null,
    concentration,
    totalLabels: labels.length,
    normalizedTerms,
  };
}

/**
 * Detect subcategories from labels for more specific naming.
 */
function detectSubcategories(labels: string[]): SubcategoryMatch | null {
  const lowercaseLabels = labels.map((l) => l.toLowerCase());

  for (const subcategory of SUBCATEGORY_PATTERNS) {
    const matchedIndices = new Set<number>();

    // Check pattern matches
    for (let i = 0; i < labels.length; i++) {
      for (const pattern of subcategory.patterns) {
        if (pattern.test(labels[i])) {
          matchedIndices.add(i);
          break; // Only count each label once per pattern
        }
      }
    }

    // Check keyword matches (only for labels not already matched by patterns)
    for (let i = 0; i < lowercaseLabels.length; i++) {
      if (matchedIndices.has(i)) continue; // Skip already matched labels
      for (const keyword of subcategory.keywords) {
        if (lowercaseLabels[i].includes(keyword)) {
          matchedIndices.add(i);
          break; // Only count each label once per keyword
        }
      }
    }

    if (matchedIndices.size >= subcategory.minMatches) {
      return {
        names: subcategory.names,
        confidenceBoost: subcategory.confidenceBoost,
      };
    }
  }

  return null;
}

/**
 * Get the most common specific term for naming.
 * E.g., if there are many "screw" items, use "Screw" in the name.
 */
function getMostCommonTerm(normalizedTerms: string[]): string | null {
  if (normalizedTerms.length === 0) return null;

  const counts = new Map<string, number>();
  for (const term of normalizedTerms) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const [topTerm, topCount] = sorted[0] ?? [null, 0];

  // Only return if it's dominant (at least 40% of terms)
  if (topTerm && topCount >= normalizedTerms.length * 0.4) {
    // Convert snake_case to Title Case
    return topTerm
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return null;
}

/**
 * Detect location/room from labels.
 */
function detectLocation(labels: string[]): string | null {
  const lowercaseLabels = labels.map((l) => l.toLowerCase()).join(' ');

  for (const pattern of LOCATION_PATTERNS) {
    const matchCount = pattern.keywords.filter((kw) => lowercaseLabels.includes(kw)).length;
    if (matchCount >= 2) {
      return pattern.location;
    }
  }

  return null;
}

/**
 * Analyze categories to find dominant theme.
 */
function analyzeCategories(categories: CategoryCount[]): {
  concentration: number;
  categoryNames: string[];
} {
  if (categories.length === 0) {
    return { concentration: 0, categoryNames: [] };
  }

  const sorted = [...categories].sort((a, b) => b.count - a.count);
  const totalBins = categories.reduce((sum, c) => sum + c.count, 0);
  const primaryCount = sorted[0]?.count ?? 0;
  const concentration = totalBins > 0 ? primaryCount / totalBins : 0;

  // Collect all meaningful category names (excluding default color names)
  const defaultColors = ['Coral', 'Sky', 'Green', 'Cloud', 'Charcoal', 'Purple', 'Orange'];
  const categoryNames = categories
    .filter((c) => !defaultColors.includes(c.name))
    .map((c) => c.name);

  return { concentration, categoryNames };
}

/**
 * Generate a pattern-based name from domain.
 * Capitalizes the pattern and appends it to the domain base name.
 */
function generatePatternName(domain: LabelDomain, pattern: NamingPattern): string {
  const base = DOMAIN_NAMING[domain].name;
  const suffix = pattern.charAt(0).toUpperCase() + pattern.slice(1);
  return `${base} ${suffix}`;
}

/**
 * Generate name suggestions from layout data.
 *
 * Strategies (in order of preference):
 * 1. Subcategory detection - most specific (Metric Hardware, Soldering Station, etc.)
 * 2. Label domain analysis - strongest signal from actual bin contents
 * 3. Specific term naming - uses most common item (Screw Organizer)
 * 4. Purpose inference - from existing purposeInference.ts
 * 5. Category-based - uses custom category names if significant
 * 6. Creative domain names - variety of patterns
 * 7. Dimensions-based - fallback using drawer size
 *
 * @param input - Layout data to analyze
 * @returns Ranked suggestions with confidence scores
 */
export function generateSuggestions(input: SuggestionInput): SuggestionResult {
  const suggestions: NameSuggestion[] = [];
  const { labels, categories, drawer, purpose } = input;

  const add = (name: string, source: SuggestionSource, confidence: number): void => {
    suggestions.push({ name, source, confidence });
  };

  const { descriptor: sizeDesc, adjective: sizeAdj } = getSizeInfo(drawer.width, drawer.depth);

  // Analyze labels for domains and specific terms
  const domainAnalysis = analyzeLabels(labels);
  const subcategoryMatch = detectSubcategories(labels);
  const specificTerm = getMostCommonTerm(domainAnalysis.normalizedTerms);

  // Strategy 1: Subcategory detection (highest confidence - most specific)
  if (subcategoryMatch && subcategoryMatch.names.length > 0) {
    const baseConfidence = Math.min(1.0, 0.85 + subcategoryMatch.confidenceBoost);

    // Add all subcategory names with decreasing confidence
    subcategoryMatch.names.forEach((name, index) => {
      add(name, 'labels', Math.max(0.5, baseConfidence - index * 0.1));
    });
  }

  // Strategy 2: Label domain analysis
  if (domainAnalysis.primaryDomain && domainAnalysis.concentration >= 0.3) {
    const domain = domainAnalysis.primaryDomain;
    const naming = DOMAIN_NAMING[domain];
    const baseConfidence = 0.5 + domainAnalysis.concentration * 0.35;
    const seed = labels.length + drawer.width * drawer.depth; // Deterministic variety

    // Primary pattern-based names (standard)
    naming.patterns.slice(0, 2).forEach((pattern, index) => {
      add(generatePatternName(domain, pattern), 'labels', baseConfidence - index * 0.05);
    });

    // Creative/playful names (more interesting!)
    if (naming.creativeNames.length > 0) {
      add(pickCreativeName(naming.creativeNames, seed), 'labels', baseConfidence + 0.02);
      add(pickCreativeName(naming.creativeNames, seed + 3), 'labels', baseConfidence - 0.03);
    }

    // Casual names (how someone might refer to it)
    if (naming.casualNames.length > 0) {
      add(pickCreativeName(naming.casualNames, seed), 'labels', baseConfidence - 0.05);
    }

    // Location-implied names
    if (naming.locationNames.length > 0) {
      add(pickCreativeName(naming.locationNames, seed), 'labels', baseConfidence - 0.08);
    }

    // Simple suffix variant
    const suffix = pickCreativeName(SIMPLE_SUFFIXES, seed);
    add(`${naming.name} ${suffix}`, 'labels', baseConfidence - 0.1);

    // Size-prefixed variant
    add(
      `${sizeDesc} ${naming.name} ${naming.patterns[0] === 'drawer' ? 'Drawer' : 'Organizer'}`,
      'labels',
      baseConfidence - 0.12
    );

    // Activity-based names from domain config
    if (naming.activityNames && naming.activityNames.length > 0) {
      add(pickCreativeName(naming.activityNames, seed), 'labels', baseConfidence - 0.1);
    }

    // Multi-domain suggestion
    if (domainAnalysis.secondaryDomain) {
      const secondaryNaming = DOMAIN_NAMING[domainAnalysis.secondaryDomain];
      add(`${naming.name} & ${secondaryNaming.name}`, 'labels', baseConfidence - 0.15);
    }
  }

  // Strategy 3: Specific term naming (e.g., "Screw Organizer" if mostly screws)
  if (specificTerm) {
    add(`${specificTerm} Organizer`, 'labels', 0.75);
    add(`${specificTerm} Collection`, 'labels', 0.7);
    add(`${specificTerm} Storage`, 'labels', 0.65);
  }

  // Strategy 4: Purpose inference (from purposeInference.ts result)
  if (purpose) {
    const purposeName = PURPOSE_NAMES[purpose] ?? purpose;

    add(`${purposeName} Organizer`, 'purpose', 0.65);
    add(`${purposeName} Drawer`, 'purpose', 0.6);
    add(`${purposeName} Essentials`, 'purpose', 0.55);
    add(`${sizeAdj} ${purposeName}`, 'purpose', 0.5);
  }

  // Strategy 5: Category-based (if user has custom categories)
  const categoryAnalysis = analyzeCategories(categories);

  if (categoryAnalysis.categoryNames.length > 0) {
    const primaryCat = categoryAnalysis.categoryNames[0];

    if (categoryAnalysis.concentration >= 0.5) {
      add(`${primaryCat} Drawer`, 'categories', 0.6 + categoryAnalysis.concentration * 0.2);
      add(`${primaryCat} Organizer`, 'categories', 0.55 + categoryAnalysis.concentration * 0.2);
    }

    // Multi-category name
    if (categoryAnalysis.categoryNames.length >= 2) {
      const secondaryCat = categoryAnalysis.categoryNames[1];
      add(`${primaryCat} & ${secondaryCat}`, 'categories', 0.5);
    }

    // If there are many categories, suggest a general name
    if (categoryAnalysis.categoryNames.length >= 4) {
      add('Multi-Category Organizer', 'categories', 0.45);
    }
  }

  // Strategy 6: Location-based suggestions
  const detectedLocation = detectLocation(labels);
  if (detectedLocation) {
    add(`${detectedLocation} Drawer`, 'labels', 0.6);
    add(`${detectedLocation} Organizer`, 'labels', 0.55);
  }

  // Strategy 7: Quantity-based suggestions (consolidated from former strategies 7-9)
  const quantityInfo = getQuantityInfo(labels.length);
  if (quantityInfo.prefix && domainAnalysis.primaryDomain) {
    const naming = DOMAIN_NAMING[domainAnalysis.primaryDomain];
    add(`${quantityInfo.prefix} ${naming.name} Set`, 'labels', 0.5);
  }
  // Add casual quantity-based names
  quantityInfo.casualNames.forEach((name, index) => {
    add(name, 'dimensions', 0.45 - index * 0.05);
  });

  // Strategy 8: Dimensions-based fallback (always available)
  // Simple, natural-sounding names with personality
  const fallbacks = [
    { name: `${sizeDesc} Drawer`, confidence: 0.3 },
    { name: 'My Drawer', confidence: 0.29 },
    { name: 'Stuff I Need', confidence: 0.28 },
    { name: 'Bits and Pieces', confidence: 0.27 },
    { name: 'Odds and Ends', confidence: 0.26 },
    { name: "Don't Lose This", confidence: 0.25 },
    { name: 'Important Things', confidence: 0.24 },
    { name: 'Organized Chaos', confidence: 0.23 },
    { name: 'The Good Drawer', confidence: 0.22 },
    { name: 'Stuff', confidence: 0.21 },
  ];

  // Add size-specific names with more personality
  const area = drawer.width * drawer.depth;
  if (area <= 12) {
    fallbacks.unshift({ name: 'Tiny Treasures', confidence: 0.31 });
    fallbacks.unshift({ name: 'Small but Mighty', confidence: 0.3 });
  } else if (area <= 20) {
    fallbacks.unshift({ name: 'Compact Drawer', confidence: 0.3 });
    fallbacks.unshift({ name: 'Little Things', confidence: 0.29 });
  } else if (area >= 150) {
    fallbacks.unshift({ name: 'The Big One', confidence: 0.31 });
    fallbacks.unshift({ name: 'Everything Drawer', confidence: 0.3 });
  } else if (area >= 100) {
    fallbacks.unshift({ name: 'Big Drawer', confidence: 0.3 });
    fallbacks.unshift({ name: 'Room for More', confidence: 0.29 });
  }

  for (const fallback of fallbacks) {
    add(fallback.name, 'dimensions', fallback.confidence);
  }

  // Build set of existing names (case-insensitive) to avoid duplicates
  const existingNamesSet = new Set((input.existingNames ?? []).map((n) => n.toLowerCase().trim()));

  // Sort by confidence (highest first), deduplicate, and filter out existing names
  const sorted = suggestions.sort((a, b) => b.confidence - a.confidence);
  const seen = new Set<string>();
  const unique = sorted.filter((s) => {
    const normalized = s.name.toLowerCase();
    // Skip if already in suggestions
    if (seen.has(normalized)) return false;
    // Skip if already exists in library (user already has "Tool Drawer")
    if (existingNamesSet.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  // Take top 5 suggestions (increased from 4 for more variety)
  const [primary, ...rest] = unique.slice(0, 5);

  return {
    primary,
    alternatives: rest,
    timestamp: Date.now(),
  };
}
