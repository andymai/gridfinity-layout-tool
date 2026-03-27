import { clamp } from '@/shared/utils';

export interface BinTextInput {
  /** Minimum of pixel width and pixel height */
  binPixelMin: number;
  /** Pixel width of the bin */
  binPixelWidth: number;
  /** Pixel height of the bin */
  binPixelHeight: number;
  /** Bin depth in grid units */
  binDepth: number;
  /** Bin width in grid units */
  binWidth: number;
  /** Bin label (empty string if no label) */
  label: string;
  /** Formatted dimensions text (e.g., "2x3") */
  dimensionsText: string;
}

export interface BinTextResult {
  shouldRotate: boolean;
  primaryFontSize: number;
  secondaryFontSize: number;
  showLabel: boolean;
  primaryText: string;
  secondaryText: string | null;
  letterSpacing: '0.02em' | 'normal';
}

/**
 * Pure function that calculates text layout for a bin:
 * font sizes, rotation, which text to show, and letter spacing.
 */
export function calculateBinText(input: BinTextInput): BinTextResult {
  const { binPixelMin, binPixelWidth, binPixelHeight, binDepth, binWidth, label, dimensionsText } =
    input;

  const hasLabel = label.length > 0;
  const minFontSize = 9;
  const maxFontSize = clamp(Math.round(binPixelMin * 0.28), 9, 20);

  // Smart rotation: use taller dimension for text if significantly taller
  const shouldRotate = binDepth > binWidth * 1.5;

  // Available width for text (very conservative: 75% of bin width to account for padding)
  const rawAvailableWidth = shouldRotate ? binPixelHeight : binPixelWidth;
  const effectiveAvailableWidth = rawAvailableWidth * 0.75;

  // Calculate if label fits and at what font size
  let labelFits = false;
  let labelFontSize = maxFontSize;

  if (hasLabel) {
    const labelLength = label.length;
    const neededFontSize = effectiveAvailableWidth / (labelLength * 0.6);

    if (neededFontSize >= minFontSize) {
      labelFits = true;
      labelFontSize = clamp(Math.floor(neededFontSize), minFontSize, maxFontSize);
    }
  }

  const primaryFontSize = labelFits ? labelFontSize : maxFontSize;
  const secondaryFontSize = clamp(Math.round(primaryFontSize * 0.75), 8, 14);

  // Visibility thresholds
  const rawAvailableHeight = shouldRotate ? binPixelWidth : binPixelHeight;
  const hasSpaceForSecondary = rawAvailableHeight * 0.75 >= primaryFontSize * 2.5;

  // Show label if it fits, otherwise show dimensions
  const showLabel = hasLabel && labelFits;
  const primaryText = showLabel && label ? label : dimensionsText;
  const secondaryText = showLabel && hasSpaceForSecondary ? dimensionsText : null;

  return {
    shouldRotate,
    primaryFontSize,
    secondaryFontSize,
    showLabel,
    primaryText,
    secondaryText,
    letterSpacing: primaryFontSize < 11 ? '0.02em' : 'normal',
  };
}
