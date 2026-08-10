import { describe, it, expect } from 'vitest';
import {
  calibrationNodes,
  calibrationSpanMm,
  CALIBRATION_COLS,
  CALIBRATION_ROWS,
  CALIBRATION_PITCH_MM,
} from './calibrationGrid';
import { BASEPLATE_PITCH_MM } from './baseplateDetect';

describe('calibrationNodes', () => {
  it('places markers on the outer ring only, leaving the tool area clear', () => {
    const nodes = calibrationNodes();
    expect(nodes).toHaveLength(2 * (CALIBRATION_COLS + CALIBRATION_ROWS) - 4);
    for (const node of nodes) {
      const onEdge =
        node.col === 0 ||
        node.col === CALIBRATION_COLS - 1 ||
        node.row === 0 ||
        node.row === CALIBRATION_ROWS - 1;
      expect(onEdge).toBe(true);
    }
  });

  it('spaces nodes at the pitch, with the origin at node (0, 0)', () => {
    for (const node of calibrationNodes()) {
      expect(node.x).toBeCloseTo(node.col * CALIBRATION_PITCH_MM, 9);
      expect(node.y).toBeCloseTo(node.row * CALIBRATION_PITCH_MM, 9);
    }
    const span = calibrationSpanMm();
    expect(span.width).toBe((CALIBRATION_COLS - 1) * CALIBRATION_PITCH_MM);
    expect(span.height).toBe((CALIBRATION_ROWS - 1) * CALIBRATION_PITCH_MM);
  });

  it('transposes cleanly, for a sheet photographed sideways', () => {
    const upright = calibrationNodes(CALIBRATION_COLS, CALIBRATION_ROWS);
    const sideways = calibrationNodes(CALIBRATION_ROWS, CALIBRATION_COLS);
    expect(sideways).toHaveLength(upright.length);
    expect(Math.max(...sideways.map((n) => n.x))).toBe(Math.max(...upright.map((n) => n.y)));
  });

  // Not a coincidence: the sheet uses Gridfinity's own unit so its lattice and a
  // baseplate's socket grid are the same lattice, solved by the same fitter.
  it('uses the same pitch as a Gridfinity baseplate', () => {
    expect(CALIBRATION_PITCH_MM).toBe(BASEPLATE_PITCH_MM);
  });
});
