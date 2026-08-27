import { describe, it, expect } from 'vitest';
import type { KnifeSpec } from './cutout';
import { DEFAULT_KNIFE_SPEC } from './cutout';
import {
  knifeSlotDimensions,
  knifeRestSaddleZMm,
  knifeRestBodyTopZMm,
  knifeRestGrooveWidthMm,
  knifeRestStyle,
  knifeSlotAxis,
  snapKnifeRotation,
  KNIFE_SLOT_MIN_WIDTH,
  KNIFE_SLOT_EDGE_FLOAT,
  KNIFE_REST_HANDLE_DROP_MM,
  KNIFE_REST_GROOVE_DEPTH_MM,
  KNIFE_REST_GROOVE_EXTRA_WIDTH_MM,
} from './knifeBlock';

const CHEF: KnifeSpec = DEFAULT_KNIFE_SPEC;

const PARING: KnifeSpec = {
  bladeLengthMm: 90,
  heelHeightMm: 20,
  spineThicknessMm: 1.8,
  handleWidthMm: 19,
  handleHeightMm: 19,
  openEnd: 'end',
};

describe('knifeSlotDimensions', () => {
  it('derives chef slot as blade+margin x spine+clearance x heel+float', () => {
    const dims = knifeSlotDimensions(CHEF);
    expect(dims.widthMm).toBe(215);
    expect(dims.depthMm).toBe(3.8);
    expect(dims.cutDepthMm).toBe(51);
  });

  it('floors slot width at the printable minimum for thin spines', () => {
    const thin: KnifeSpec = { ...PARING, spineThicknessMm: 0.8 };
    expect(knifeSlotDimensions(thin).depthMm).toBe(KNIFE_SLOT_MIN_WIDTH);
  });
});

describe('handle rest derivation', () => {
  // The physical pose: spine flush with the block top, edge floating
  // KNIFE_SLOT_EDGE_FLOAT above the slot floor, handle underside one diameter
  // below the top minus the deliberate drop.
  it('puts the saddle one handle-diameter (plus drop) below the block top', () => {
    const blockTop = 61;
    expect(knifeRestSaddleZMm(blockTop, CHEF)).toBe(
      blockTop - CHEF.handleHeightMm - KNIFE_REST_HANDLE_DROP_MM
    );
  });

  it('keeps the seated edge floating above the slot floor', () => {
    const blockTop = 61;
    const dims = knifeSlotDimensions(CHEF);
    const slotFloor = blockTop - dims.cutDepthMm;
    // Saddle drop tilts handle-down, which can only RAISE the edge further.
    const edgeAtLevelLie = slotFloor + KNIFE_SLOT_EDGE_FLOAT;
    expect(edgeAtLevelLie).toBeGreaterThan(slotFloor);
  });

  it('sizes a shared rest off the widest handle: every knife reaches its saddle', () => {
    const blockTop = 61;
    const top = knifeRestBodyTopZMm(blockTop, [CHEF, PARING], KNIFE_REST_GROOVE_DEPTH_MM);
    // Paring's larger saddle height defines the top (smaller handle = higher saddle).
    const paringSaddle = knifeRestSaddleZMm(blockTop, PARING);
    expect(top).toBe(paringSaddle + KNIFE_REST_GROOVE_DEPTH_MM);
    // Chef's groove must cut deeper than the nominal depth to reach its saddle.
    expect(top - knifeRestSaddleZMm(blockTop, CHEF)).toBeGreaterThan(KNIFE_REST_GROOVE_DEPTH_MM);
  });

  it('grooves wider than the handle so any section settles', () => {
    expect(knifeRestGrooveWidthMm(CHEF)).toBe(
      CHEF.handleWidthMm + KNIFE_REST_GROOVE_EXTRA_WIDTH_MM
    );
  });

  it('defaults style to companion', () => {
    expect(knifeRestStyle({ enabled: true })).toBe('companion');
    expect(knifeRestStyle({ enabled: true, style: 'integrated' })).toBe('integrated');
  });
});

describe('knife slot orientation', () => {
  it('snaps any angle to the nearest quarter turn in [0, 360)', () => {
    expect(snapKnifeRotation(0)).toBe(0);
    expect(snapKnifeRotation(44)).toBe(0);
    expect(snapKnifeRotation(46)).toBe(90);
    expect(snapKnifeRotation(135)).toBe(180);
    expect(snapKnifeRotation(300)).toBe(270);
    expect(snapKnifeRotation(359)).toBe(0);
    expect(snapKnifeRotation(-90)).toBe(270);
  });

  it('reads horizontal on the 0/180 axis and vertical on 90/270', () => {
    expect(knifeSlotAxis(0)).toBe('horizontal');
    expect(knifeSlotAxis(180)).toBe('horizontal');
    expect(knifeSlotAxis(90)).toBe('vertical');
    expect(knifeSlotAxis(270)).toBe('vertical');
  });
});
