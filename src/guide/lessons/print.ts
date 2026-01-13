import type { Lesson } from './types';

/**
 * Lesson: Ready to Print
 * Teaches print optimization concepts.
 */
const lesson: Lesson = {
  id: 'print',
  title: 'Ready to Print',
  tagline: 'From pixels to plastic',
  description:
    'Understand the print list, automatic bin splitting for your print bed, and how to estimate filament usage.',
  icon: '🖨️',
  difficulty: 'intermediate',
  estimatedMinutes: 2,

  sandbox: {
    width: 8,
    depth: 6,
    initialBins: [
      { x: 0, y: 0, width: 3, depth: 2, category: 'general' },
      { x: 4, y: 0, width: 2, depth: 2, category: 'tools' },
      { x: 0, y: 3, width: 4, depth: 3, category: 'hardware' },
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
      canChangeCategory: false,
    },
  },

  steps: [
    {
      id: 'intro-print',
      instruction: 'Your design becomes real with 3D printing',
      detail: 'The Print List in the full app shows all bins sized for your printer.',
      validation: { type: 'always' },
      successMessage: 'Let\'s learn about printing!',
    },
    {
      id: 'understand-splitting',
      instruction: 'Large bins get split automatically',
      detail: 'If a bin is larger than your print bed, it\'s split into printable pieces. You\'ll see this in the Print List.',
      tip: 'Configure your print bed size in settings to get accurate splitting.',
      validation: { type: 'always' },
      successMessage: 'Smart splitting saves the day!',
    },
    {
      id: 'create-large-bin',
      instruction: 'Draw a large bin (at least 5×4 units)',
      detail: 'In the full app, this would show a "Split" badge if it exceeds your print bed.',
      validation: {
        type: 'bin_exists',
        params: { width: 5, depth: 4 },
      },
      successMessage: 'That\'s a big one! Ready for splitting.',
    },
    {
      id: 'filament-estimate',
      instruction: 'Filament estimation',
      detail: 'The Print List estimates how much filament you\'ll use. Great for planning before you print!',
      validation: { type: 'always' },
      successMessage: 'You\'re ready to print! Check out the Print List in the full app.',
    },
  ],
};

export default lesson;
