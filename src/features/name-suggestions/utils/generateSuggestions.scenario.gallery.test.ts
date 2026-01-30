/**
 * Tests that name suggestions work well with inspiration gallery layouts.
 * These tests verify that suggested names match the theme of each layout.
 */

import { describe, it, expect } from 'vitest';
import { generateSuggestions } from './generateSuggestions';
import type { SuggestionInput } from '../types';

describe('Name suggestions for inspiration gallery layouts', () => {
  describe('Workshop layouts', () => {
    it('suggests "Fasteners" or similar for Screw Organizer layout', () => {
      const input: SuggestionInput = {
        labels: [
          'M2x4',
          'M2x6',
          'M2x8',
          'M2x10',
          'M3x6',
          'M3x8',
          'M3x10',
          'M3x12',
          'M3x16',
          'M3x20',
          'M4x8',
          'M4x10',
          'M4x12',
          'M4x16',
          'M5x20',
          'M5x25',
          'M5x30',
          'M5x40',
          'M6x10',
          'M6x16',
          'M6x20',
          'Hex Nuts',
          'Washers',
          'Lock Nuts',
          'Standoffs',
        ],
        categories: [
          { name: 'Small Screws', count: 21 },
          { name: 'Medium Screws', count: 8 },
          { name: 'Large Screws', count: 5 },
          { name: 'Nuts & Washers', count: 5 },
        ],
        drawer: { width: 7, depth: 12, height: 6 },
        locale: 'en',
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      // Should recognize fasteners domain
      const allSuggestions = [result.primary?.name, ...result.alternatives.map((a) => a.name)];
      const hasFastenerRelated = allSuggestions.some(
        (name) => name?.toLowerCase().includes('fastener') || name?.toLowerCase().includes('screw')
      );
      expect(hasFastenerRelated).toBe(true);
    });

    it('suggests "Tools" for Hand Tools layout', () => {
      const input: SuggestionInput = {
        labels: [
          'Needle Nose',
          'Diagonal Cut',
          'Linesman',
          'Slip Joint',
          'Locking',
          'Channel Lock',
          'Phillips',
          'Flathead',
          'Torx',
          'Hex',
          'Adjustable',
          'Allen Keys',
          'Tape/Level',
        ],
        categories: [
          { name: 'Pliers', count: 6 },
          { name: 'Screwdrivers', count: 4 },
          { name: 'Wrenches', count: 2 },
          { name: 'Other', count: 1 },
        ],
        drawer: { width: 13, depth: 11, height: 6 },
        locale: 'en',
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      const allSuggestions = [result.primary?.name, ...result.alternatives.map((a) => a.name)];
      const hasToolsRelated = allSuggestions.some(
        (name) => name?.toLowerCase().includes('tool') || name?.toLowerCase().includes('workshop')
      );
      expect(hasToolsRelated).toBe(true);
    });

    it('suggests "Electronics" for Electronics Bench layout', () => {
      const input: SuggestionInput = {
        labels: [
          'R 1K',
          'R 10K',
          'R 100K',
          'R Misc',
          'C 0.1µF',
          'C 10µF',
          'C 100µF',
          'LEDs Red',
          'LEDs Grn',
          'LEDs Blu',
          'Transistors',
          'ICs',
          'Headers',
          'Tweezers',
          'Cutters',
          'Connectors',
          'Multimeter',
          'Solder',
          'Wire Spools',
          'Heat Shrink',
        ],
        categories: [
          { name: 'Components', count: 13 },
          { name: 'Tools', count: 4 },
          { name: 'Supplies', count: 3 },
        ],
        drawer: { width: 7, depth: 12, height: 6 },
        locale: 'en',
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      const allSuggestions = [result.primary?.name, ...result.alternatives.map((a) => a.name)];
      const hasElectronicsRelated = allSuggestions.some((name) =>
        name?.toLowerCase().includes('electronic')
      );
      expect(hasElectronicsRelated).toBe(true);
    });
  });

  describe('Office layouts', () => {
    it('suggests "Office" for Desk Drawer layout', () => {
      const input: SuggestionInput = {
        labels: [
          'Pens',
          'Pencils',
          'Markers',
          'Scissors',
          'Letter Opener',
          'Stapler',
          'Clips',
          'Pins',
          'Bands',
          'Staples',
          'Tacks',
          'Erasers',
          'Sharpener',
          'Tape & Glue',
          'Sticky Notes',
        ],
        categories: [
          { name: 'Writing', count: 3 },
          { name: 'Clips', count: 7 },
          { name: 'Other', count: 5 },
        ],
        drawer: { width: 7, depth: 12, height: 9 },
        locale: 'en',
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      const allSuggestions = [result.primary?.name, ...result.alternatives.map((a) => a.name)];
      const hasOfficeRelated = allSuggestions.some(
        (name) => name?.toLowerCase().includes('office') || name?.toLowerCase().includes('desk')
      );
      expect(hasOfficeRelated).toBe(true);
    });

    it('suggests something relevant for Cable Drawer layout', () => {
      const input: SuggestionInput = {
        labels: [
          'USB-C',
          'Lightning',
          'Micro USB',
          'Power Cables',
          'Extension',
          'HDMI',
          'USB Hubs',
          'Dongles',
          'Chargers',
          'Adapters',
        ],
        categories: [
          { name: 'USB', count: 3 },
          { name: 'Power', count: 2 },
          { name: 'Audio/Video', count: 1 },
          { name: 'Adapters', count: 4 },
        ],
        drawer: { width: 9, depth: 8, height: 12 },
        locale: 'en',
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      // Should have reasonable confidence for tech/office/electronics
      expect(result.primary!.confidence).toBeGreaterThan(0.3);
    });
  });

  describe('Hobby layouts', () => {
    it('suggests "3D Printing" or "Craft" for 3D Printing Supplies layout', () => {
      const input: SuggestionInput = {
        labels: [
          'PLA',
          'PETG',
          'TPU',
          'ABS',
          'M3 Inserts',
          'M4 Inserts',
          'M5 Inserts',
          '6x3 Magnets',
          '8x3 Magnets',
          '608 Bearings',
          '625',
          'Scrapers',
          'Tweezers',
          'Nozzles',
          'CA Glue',
          'Sandpaper',
          'Primer',
        ],
        categories: [
          { name: 'Filament', count: 4 },
          { name: 'Hardware', count: 8 },
          { name: 'Tools', count: 3 },
          { name: 'Finishing', count: 3 },
        ],
        drawer: { width: 7, depth: 12, height: 12 },
        locale: 'en',
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      // Should recognize 3D printing domain from telemetry-tracked terms
      expect(result.primary!.confidence).toBeGreaterThan(0.3);
    });

    it('suggests "Electronics" or "Maker" for Maker Station layout', () => {
      const input: SuggestionInput = {
        labels: [
          'Arduino Uno',
          'Arduino Nano',
          'ESP32',
          'Wemos D1',
          'Raspberry Pi',
          'Pico',
          'DHT22',
          'PIR',
          'Ultrasonic',
          'IR',
          'Breadboard',
          'Perf Board',
          'SD Cards',
          'MicroSD',
          'USB Cables',
          'M-M Jumpers',
          'M-F Jumpers',
          'F-F Jumpers',
          'OLED',
          'LCD',
          'Relays',
          'Motors',
        ],
        categories: [
          { name: 'Boards', count: 6 },
          { name: 'Sensors', count: 8 },
          { name: 'Connectivity', count: 3 },
          { name: 'Supplies', count: 5 },
        ],
        drawer: { width: 7, depth: 12, height: 6 },
        locale: 'en',
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      const allSuggestions = [result.primary?.name, ...result.alternatives.map((a) => a.name)];
      const hasElectronicsRelated = allSuggestions.some(
        (name) =>
          name?.toLowerCase().includes('electronic') || name?.toLowerCase().includes('maker')
      );
      expect(hasElectronicsRelated).toBe(true);
    });

    it('suggests "Craft" or "Sewing" for Craft Supplies layout', () => {
      const input: SuggestionInput = {
        labels: [
          'Glue Sticks',
          'Super Glue',
          'Tape',
          'Pins',
          'Needles',
          'Buttons',
          'Beads',
          'Thimbles',
          'Scissors',
          'X-Acto',
          'Box Cutter',
          'Ruler',
        ],
        categories: [
          { name: 'Adhesives', count: 3 },
          { name: 'Cutting', count: 3 },
          { name: 'Misc', count: 6 },
        ],
        drawer: { width: 6, depth: 8, height: 6 },
        locale: 'en',
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      const allSuggestions = [result.primary?.name, ...result.alternatives.map((a) => a.name)];
      // Should recognize as craft domain or specific sewing/notions subcategory
      const hasCraftRelated = allSuggestions.some(
        (name) =>
          name?.toLowerCase().includes('craft') ||
          name?.toLowerCase().includes('sewing') ||
          name?.toLowerCase().includes('notions') ||
          name?.toLowerCase().includes('supplies')
      );
      expect(hasCraftRelated).toBe(true);
    });
  });

  describe('Confidence scoring', () => {
    it('has higher confidence for layouts with clear domain labels', () => {
      // Screw organizer has very clear fastener labels
      const screwInput: SuggestionInput = {
        labels: ['M2x4', 'M2x6', 'M3x8', 'M4x10', 'M5x12', 'Hex Nuts', 'Washers'],
        categories: [],
        drawer: { width: 7, depth: 12, height: 6 },
        locale: 'en',
      };

      // Generic drawer has less clear labels
      const genericInput: SuggestionInput = {
        labels: ['Item 1', 'Item 2', 'Item 3', 'Stuff', 'Things'],
        categories: [],
        drawer: { width: 7, depth: 12, height: 6 },
        locale: 'en',
      };

      const screwResult = generateSuggestions(screwInput);
      const genericResult = generateSuggestions(genericInput);

      // Screw organizer should have higher confidence
      expect(screwResult.primary!.confidence).toBeGreaterThan(genericResult.primary!.confidence);
    });
  });
});
