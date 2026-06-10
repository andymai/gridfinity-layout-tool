import { box, draw, fuse, cut, unwrap } from 'brepjs';

// Fit gauge for the connector fit-sample dovetail (offset 0): seat the male
// coupon against the female coupon as they mate at the seam (y=0) and confirm
// there is NO interference. If the nominal tongue clears the clearance-grown
// groove, the fused volume equals the sum of the two coupons' volumes
// (692.265 + 652.616). Interference would merge overlapping material and drop
// the volume below the sum — so the volume assertion IS the fit check.
const COUPON_X = 15;
const COUPON_Y = 9;
const H = 5;
const P = 1.5;
const bW = 1.0;
const tW = 1.3;
const CL = 0.15; // per-side groove clearance at offset 0
const OV = 0.01;
const EXT = 1;
const MARGIN = 1;

export default () => {
  // Male: -Y block + nominal tongue protruding +Y across the seam.
  const maleBlock = box(COUPON_X, COUPON_Y, H, { at: [0, -COUPON_Y / 2, -H / 2] });
  const tongue = draw([bW, -OV])
    .lineTo([tW, P])
    .lineTo([-tW, P])
    .lineTo([-bW, -OV])
    .close()
    .sketchOnPlane('XY', 0)
    .extrude(-H);
  const male = unwrap(fuse(maleBlock, tongue));

  // Female: +Y block with the clearance-grown groove opening toward the seam.
  const femaleBlock = box(COUPON_X, COUPON_Y, H, { at: [0, COUPON_Y / 2, -H / 2] });
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
  const female = unwrap(cut(femaleBlock, groove));

  return unwrap(fuse(male, female));
};

export const expected = { volume: 1344.881, tolerancePct: 0.5 };
