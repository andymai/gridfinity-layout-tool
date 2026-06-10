import { box, draw, fuse, unwrap } from 'brepjs';

// Faithful reconstruction of the fit-sample dovetail MALE coupon
// (connectorSample.ts buildCoupon + baseplateConnectors.makeTongue, offset 0).
const COUPON_X = 15;
const COUPON_Y = 9;
const H = 5; // SOCKET_HEIGHT (no magnet)
const P = 1.5; // TONGUE_PROTRUSION
const bW = 1.0; // TONGUE_BASE_HALF (narrow, at wall)
const tW = 1.3; // TONGUE_TIP_HALF (wide, at tip)
const OV = 0.01; // COPLANAR_OVERLAP

export default () => {
  // Block on the -Y side, mating wall at y=0, top at z=0 (`at` = box center).
  const block = box(COUPON_X, COUPON_Y, H, { at: [0, -COUPON_Y / 2, -H / 2] });
  // Nominal tongue protruding +Y from the wall (trapezoid: narrow at wall, wide at tip).
  const tongue = draw([bW, -OV])
    .lineTo([tW, P])
    .lineTo([-tW, P])
    .lineTo([-bW, -OV])
    .close()
    .sketchOnPlane('XY', 0)
    .extrude(-H);
  return unwrap(fuse(block, tongue));
};
