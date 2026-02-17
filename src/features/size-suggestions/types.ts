export interface SizeSuggestion {
  size: string;
  score: number;
  position: { x: number; y: number } | null;
  positionSource: string;
}

export interface SizeSuggestResponse {
  suggestions: SizeSuggestion[];
  source: string;
}
