import type { LessonMeta } from './types';

/**
 * Lesson metadata for the guide overview.
 * Full lesson content with steps will be lazy-loaded when viewing a lesson.
 */
export const lessonMetas: LessonMeta[] = [
  {
    id: 'basics',
    title: 'Your First Bin',
    tagline: 'From zero to organized in 60 seconds',
    description:
      'Learn the fundamentals: drawing bins, selecting them, resizing, and deleting. Everything you need to start designing.',
    icon: '1️⃣',
    difficulty: 'beginner',
    estimatedMinutes: 2,
  },
  {
    id: 'categories',
    title: 'Color Your World',
    tagline: 'Because everything deserves a color code',
    description:
      'Organize your bins with categories. Color-code different types of items so your drawer tells a story at a glance.',
    icon: '🎨',
    difficulty: 'beginner',
    estimatedMinutes: 2,
  },
  {
    id: 'layers',
    title: 'Going Vertical',
    tagline: 'Stack it up, buttercup',
    description:
      'Master multi-layer drawers. Learn how bins can span layers, what blocked zones are, and how to use clearance for tall items.',
    icon: '📚',
    difficulty: 'intermediate',
    estimatedMinutes: 3,
  },
  {
    id: 'print',
    title: 'Ready to Print',
    tagline: 'From pixels to plastic',
    description:
      'Understand the print list, automatic bin splitting for your print bed, and how to estimate filament usage.',
    icon: '🖨️',
    difficulty: 'intermediate',
    estimatedMinutes: 2,
  },
];

/**
 * Get lesson metadata by ID.
 */
export function getLessonMeta(lessonId: string): LessonMeta | undefined {
  return lessonMetas.find((l) => l.id === lessonId);
}

/**
 * Total number of lessons.
 */
export const TOTAL_LESSONS = lessonMetas.length;
