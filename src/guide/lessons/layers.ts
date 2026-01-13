import type { Lesson } from './types';

/**
 * Lesson: Going Vertical
 * Teaches multi-layer concept (simplified for sandbox).
 * Note: Full layer support requires main app integration.
 */
const lesson: Lesson = {
  id: 'layers',
  title: 'Going Vertical',
  tagline: 'Stack it up, buttercup',
  description:
    'Master multi-layer drawers. Learn how bins can span layers, what blocked zones are, and how to use clearance for tall items.',
  icon: '📚',
  difficulty: 'intermediate',
  estimatedMinutes: 3,

  sandbox: {
    width: 6,
    depth: 6,
    initialBins: [],
    features: {
      canDraw: true,
      canDrag: true,
      canResize: true,
      canDelete: true,
      canChangeCategory: false,
    },
  },

  steps: [
    {
      id: 'intro',
      instruction: 'Layers let you stack storage vertically',
      detail: 'Imagine a tall drawer with multiple levels. Each layer is a separate floor for your bins.',
      validation: { type: 'always' },
      successMessage: 'Ready to think in 3D!',
    },
    {
      id: 'draw-base',
      instruction: 'Draw a bin for the bottom layer',
      detail: 'This will be our foundation. In the full app, you can switch between layers.',
      validation: { type: 'bin_count', params: { min: 1 } },
      successMessage: 'Solid foundation!',
    },
    {
      id: 'concepts',
      instruction: 'Understanding blocked zones',
      detail: 'When a tall bin spans multiple layers, it blocks space above it. This is shown with a hatched pattern in the full app.',
      tip: 'Use tall bins for items that need vertical clearance, like bottles or tall tools.',
      validation: { type: 'always' },
      successMessage: 'You\'re thinking vertically now!',
    },
    {
      id: 'practice',
      instruction: 'Draw a few more bins to fill the space',
      detail: 'In the full app, you\'d see these on layer 1 while layer 2 could have different bins.',
      validation: { type: 'bin_count', params: { min: 3 } },
      successMessage: 'Layer master! Switch to the full app to try real layers.',
    },
  ],
};

export default lesson;
