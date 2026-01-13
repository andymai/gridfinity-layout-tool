import type { Lesson } from './types';

/**
 * Lesson: Color Your World
 * Teaches category assignment and color-coding bins.
 */
const lesson: Lesson = {
  id: 'categories',
  title: 'Color Your World',
  tagline: 'Because everything deserves a color code',
  description:
    'Organize your bins with categories. Color-code different types of items so your drawer tells a story at a glance.',
  icon: '🎨',
  difficulty: 'beginner',
  estimatedMinutes: 2,

  sandbox: {
    width: 6,
    depth: 6,
    initialBins: [
      { x: 0, y: 0, width: 2, depth: 2, category: 'general' },
      { x: 3, y: 0, width: 2, depth: 2, category: 'general' },
    ],
    categories: [
      { id: 'general', name: 'General', color: '#6366f1' },
      { id: 'tools', name: 'Tools', color: '#10b981' },
      { id: 'hardware', name: 'Hardware', color: '#f59e0b' },
    ],
    features: {
      canDraw: true,
      canDrag: true,
      canResize: true,
      canDelete: true,
      canChangeCategory: true,
    },
  },

  steps: [
    {
      id: 'explore-categories',
      instruction: 'Click a category button above the grid',
      detail: 'Categories let you color-code bins. The selected category will be used for new bins.',
      validation: { type: 'always' },
      successMessage: 'Nice! Now draw a bin in that color.',
    },
    {
      id: 'draw-colored-bin',
      instruction: 'Draw a new bin with your selected category',
      detail: 'New bins will automatically use the active category color.',
      validation: { type: 'bin_count', params: { min: 3 } },
      successMessage: 'Colorful! Your drawer is coming to life.',
    },
    {
      id: 'change-category',
      instruction: 'Select a different category and draw another bin',
      detail: 'Try using a different color for variety.',
      tip: 'Use categories to group similar items — tools, hardware, electronics, etc.',
      validation: { type: 'bin_count', params: { min: 4 } },
      successMessage: 'A rainbow of organization!',
    },
    {
      id: 'complete',
      instruction: 'You\'ve mastered categories!',
      detail: 'Color-coded bins make it easy to find what you need at a glance.',
      validation: { type: 'always' },
      successMessage: 'Category champion! Your drawers will thank you.',
    },
  ],
};

export default lesson;
