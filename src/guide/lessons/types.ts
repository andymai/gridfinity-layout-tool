/**
 * Lesson metadata for display in the guide overview.
 */
export interface LessonMeta {
  id: string;
  title: string;
  tagline: string; // Witty subtitle
  description: string;
  icon: string; // Emoji
  difficulty: 'beginner' | 'intermediate';
  estimatedMinutes: number;
}

/**
 * Highlight configuration for drawing attention to UI elements.
 */
export interface HighlightConfig {
  type: 'cell' | 'area' | 'element';
  /** For cell/area: grid coordinates */
  cells?: Array<[number, number]>;
  /** For element: CSS selector or element ID */
  selector?: string;
  /** Animation style */
  style: 'pulse' | 'glow' | 'arrow';
}

/**
 * Validation rule for step completion.
 */
export interface ValidationRule {
  type:
    | 'bin_count'
    | 'bin_exists'
    | 'bin_selected'
    | 'bin_resized'
    | 'bin_deleted'
    | 'category_changed'
    | 'always'; // Always passes (for info steps)
  params?: Record<string, unknown>;
}

/**
 * Individual step in a lesson.
 */
export interface LessonStep {
  id: string;
  instruction: string; // Main instruction text
  detail?: string; // Additional context
  tip?: string; // Pro tip (collapsible)
  highlight?: HighlightConfig;
  validation: ValidationRule;
  successMessage: string; // Witty success text
}

/**
 * Sandbox configuration for a lesson.
 */
export interface SandboxConfig {
  /** Drawer width in grid units */
  width: number;
  /** Drawer depth in grid units */
  depth: number;
  /** Initial bins to populate */
  initialBins?: Array<{
    x: number;
    y: number;
    width: number;
    depth: number;
    category?: string;
    label?: string;
  }>;
  /** Which interactions are enabled */
  features: {
    canDraw: boolean;
    canDrag: boolean;
    canResize: boolean;
    canDelete: boolean;
    canChangeCategory: boolean;
  };
  /** Categories available (defaults to standard set) */
  categories?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

/**
 * Complete lesson definition.
 */
export interface Lesson extends LessonMeta {
  steps: LessonStep[];
  sandbox: SandboxConfig;
}
