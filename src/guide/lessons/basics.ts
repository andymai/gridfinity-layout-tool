import type { Lesson } from './types';

/**
 * Lesson: Your First Bin
 * Teaches the fundamentals of bin creation, selection, resizing, and deletion.
 */
const lesson: Lesson = {
  id: 'basics',
  title: 'Your First Bin',
  tagline: 'From zero to organized in 60 seconds',
  description:
    'Learn the fundamentals: drawing bins, selecting them, resizing, and deleting. Everything you need to start designing.',
  icon: '1️⃣',
  difficulty: 'beginner',
  estimatedMinutes: 2,

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
      id: 'draw-first-bin',
      instruction: 'Draw your first bin by clicking and dragging on the grid',
      detail: 'Click anywhere on the grid, hold, and drag to create a rectangle. Release to create the bin.',
      tip: 'The grid shows units, not millimeters. Each unit equals 42mm in the real world — perfect for Gridfinity!',
      validation: { type: 'bin_count', params: { min: 1 } },
      successMessage: 'Look at you go! Marie Kondo would be proud.',
    },
    {
      id: 'select-bin',
      instruction: 'Click your bin to select it',
      detail: 'Selected bins show an amber glow and reveal resize handles.',
      validation: { type: 'bin_selected' },
      successMessage: 'Selected! Now you can resize, move, or delete it.',
    },
    {
      id: 'resize-bin',
      instruction: 'Drag a corner handle to resize your bin',
      detail: 'Grab any of the small circles at the corners or edges and drag to resize.',
      tip: 'Bins snap to the grid automatically — no wobbly edges allowed!',
      validation: { type: 'bin_resized' },
      successMessage: 'Perfect fit! Size matters when organizing.',
    },
    {
      id: 'draw-second-bin',
      instruction: 'Draw another bin next to the first one',
      detail: 'Create a second bin anywhere on the grid that doesn\'t overlap.',
      validation: { type: 'bin_count', params: { min: 2 } },
      successMessage: 'Two bins! You\'re building an empire.',
    },
    {
      id: 'drag-bin',
      instruction: 'Drag one bin to move it',
      detail: 'Click and hold on a bin, then drag to reposition it.',
      validation: { type: 'always' },
      successMessage: 'Nice moves! Rearranging is half the fun.',
    },
    {
      id: 'delete-bin',
      instruction: 'Select a bin and press Delete (or Backspace) to remove it',
      detail: 'First click to select, then press the Delete key.',
      tip: 'You can also use the Delete button that appears when a bin is selected.',
      validation: { type: 'bin_deleted' },
      successMessage: 'Gone! Sometimes less is more.',
    },
  ],
};

export default lesson;
