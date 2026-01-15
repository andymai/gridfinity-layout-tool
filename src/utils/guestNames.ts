/**
 * Fun guest name generator for anonymous collaborative users.
 * Generates memorable adjective + noun combinations.
 *
 * Examples: "Cosmic Penguin", "Swift Raccoon", "Clever Fox"
 */

// Adjectives that work well with animals and are positive/fun
const ADJECTIVES = [
  'Cosmic',
  'Swift',
  'Clever',
  'Bright',
  'Bold',
  'Calm',
  'Daring',
  'Eager',
  'Fierce',
  'Gentle',
  'Happy',
  'Jolly',
  'Keen',
  'Lucky',
  'Merry',
  'Noble',
  'Plucky',
  'Quick',
  'Royal',
  'Shiny',
  'Snappy',
  'Speedy',
  'Stellar',
  'Sunny',
  'Witty',
  'Zesty',
  'Mighty',
  'Crafty',
  'Nimble',
  'Peppy',
];

// Fun animals that make good mascots
const ANIMALS = [
  'Penguin',
  'Raccoon',
  'Fox',
  'Owl',
  'Panda',
  'Koala',
  'Otter',
  'Beaver',
  'Badger',
  'Hedgehog',
  'Squirrel',
  'Rabbit',
  'Dolphin',
  'Falcon',
  'Phoenix',
  'Dragon',
  'Tiger',
  'Wolf',
  'Bear',
  'Lynx',
  'Hawk',
  'Raven',
  'Moose',
  'Elk',
  'Seal',
  'Walrus',
  'Capybara',
  'Lemur',
  'Gecko',
  'Turtle',
];

/**
 * Generate a deterministic guest name from an ID.
 * The same ID will always produce the same name within a session.
 *
 * @param id - Connection ID or any unique string
 * @returns A fun guest name like "Cosmic Penguin"
 */
export function generateGuestName(id: string | number): string {
  // Simple hash function to get consistent but varied results
  const numericId = typeof id === 'number' ? id : hashString(String(id));

  const adjIndex = Math.abs(numericId) % ADJECTIVES.length;
  const animalIndex = Math.abs(Math.floor(numericId / ADJECTIVES.length)) % ANIMALS.length;

  return `${ADJECTIVES[adjIndex]} ${ANIMALS[animalIndex]}`;
}

/**
 * Simple string hash for deterministic name generation.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Get a color for a guest based on their ID.
 * Returns a pleasant, distinguishable color.
 *
 * @param id - Connection ID or any unique string
 * @returns A hex color string
 */
export function generateGuestColor(id: string | number): string {
  const COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#84CC16', // Lime
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#A855F7', // Purple
  ];

  const numericId = typeof id === 'number' ? id : hashString(String(id));
  const colorIndex = Math.abs(numericId) % COLORS.length;

  return COLORS[colorIndex];
}
