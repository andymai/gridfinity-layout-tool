/**
 * SVG arc-segment → cubic Bezier conversion.
 *
 * Implements the W3C SVG arc implementation notes: parameterize the arc
 * around its computed center, then split into 90°-or-less sweeps and
 * approximate each sweep with a cubic Bezier.
 */

export interface BezierSegment {
  readonly cp1x: number;
  readonly cp1y: number;
  readonly cp2x: number;
  readonly cp2y: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Convert an SVG arc command to cubic bezier segments.
 * Based on the W3C SVG arc implementation notes.
 */
export function arcToCubicBeziers(
  x1: number,
  y1: number,
  _rx: number,
  _ry: number,
  xRotDeg: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number
): BezierSegment[] {
  if (Math.abs(x1 - x2) < 1e-6 && Math.abs(y1 - y2) < 1e-6) return [];

  let rx = Math.abs(_rx);
  let ry = Math.abs(_ry);
  if (rx < 1e-6 || ry < 1e-6) {
    // Degenerate arc: straight line
    return [
      {
        cp1x: x1 + (x2 - x1) / 3,
        cp1y: y1 + (y2 - y1) / 3,
        cp2x: x1 + (2 * (x2 - x1)) / 3,
        cp2y: y1 + (2 * (y2 - y1)) / 3,
        x: x2,
        y: y2,
      },
    ];
  }

  const phi = (xRotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Move to origin and un-rotate
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  // Step 2: Scale radii if needed
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  // Step 3: Compute center
  let sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq));
  sq = Math.sqrt(sq);
  if (largeArc === sweep) sq = -sq;

  const cxp = sq * ((rx * y1p) / ry);
  const cyp = sq * -((ry * x1p) / rx);

  // Step 4: Compute angles
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vectorAngle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );

  if (sweep === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  // Split into segments of at most PI/2
  const segments = Math.ceil(Math.abs(dTheta) / (Math.PI / 2));
  const segAngle = dTheta / segments;
  const result: BezierSegment[] = [];

  let startAngle = theta1;
  for (let i = 0; i < segments; i++) {
    const endAngle = startAngle + segAngle;
    const bezier = arcSegmentToBezier(cx, cy, rx, ry, phi, startAngle, endAngle);
    result.push(bezier);
    startAngle = endAngle;
  }

  return result;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
  return sign * Math.acos(Math.max(-1, Math.min(1, dot / len)));
}

function arcSegmentToBezier(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  phi: number,
  theta1: number,
  theta2: number
): BezierSegment {
  const alpha = (4 / 3) * Math.tan((theta2 - theta1) / 4);
  const cosPhi2 = Math.cos(phi);
  const sinPhi2 = Math.sin(phi);

  const cosT1 = Math.cos(theta1);
  const sinT1 = Math.sin(theta1);
  const cosT2 = Math.cos(theta2);
  const sinT2 = Math.sin(theta2);

  const ep1x = cx + cosPhi2 * rx * cosT1 - sinPhi2 * ry * sinT1;
  const ep1y = cy + sinPhi2 * rx * cosT1 + cosPhi2 * ry * sinT1;
  const ep2x = cx + cosPhi2 * rx * cosT2 - sinPhi2 * ry * sinT2;
  const ep2y = cy + sinPhi2 * rx * cosT2 + cosPhi2 * ry * sinT2;

  return {
    cp1x: ep1x + alpha * (-cosPhi2 * rx * sinT1 - sinPhi2 * ry * cosT1),
    cp1y: ep1y + alpha * (-sinPhi2 * rx * sinT1 + cosPhi2 * ry * cosT1),
    cp2x: ep2x + alpha * (cosPhi2 * rx * sinT2 + sinPhi2 * ry * cosT2),
    cp2y: ep2y + alpha * (sinPhi2 * rx * sinT2 - cosPhi2 * ry * cosT2),
    x: ep2x,
    y: ep2y,
  };
}
