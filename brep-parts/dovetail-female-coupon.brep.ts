import { box, draw, cut, unwrap } from 'brepjs';

// Faithful reconstruction of the fit-sample dovetail FEMALE coupon
// (connectorSample.ts buildCoupon + baseplateConnectors.makeGroove, offset 0).
const COUPON_X = 15;
const COUPON_Y = 9;
const H = 5; // SOCKET_HEIGHT (no magnet)
const P = 1.5; // TONGUE_PROTRUSION
const bW = 1.0; // TONGUE_BASE_HALF
const tW = 1.3; // TONGUE_TIP_HALF
const CL = 0.15; // effectiveClearance(TONGUE_CLEARANCE 0.15, offset 0)
const EXT = 1; // COPLANAR_MARGIN
const MARGIN = 1; // COPLANAR_MARGIN (Z over-extrude)

export default () => {
  // Block on the +Y side, mating wall at y=0, top at z=0 (`at` = box center).
  const block = box(COUPON_X, COUPON_Y, H, { at: [0, COUPON_Y / 2, -H / 2] });
  // Groove = tongue profile grown by the per-side clearance, opening toward the
  // seam (-Y) and cutting into the block (+Y); full-height vertical slot.
  const gB = bW + CL;
  const gT = tW + CL;
  const gP = P + CL;
  const groove = draw([gB, -EXT])
    .lineTo([gT, gP])
    .lineTo([-gT, gP])
    .lineTo([-gB, -EXT])
    .close()
    .sketchOnPlane('XY', MARGIN)
    .extrude(-(H + 2 * MARGIN));
  return unwrap(cut(block, groove));
};
