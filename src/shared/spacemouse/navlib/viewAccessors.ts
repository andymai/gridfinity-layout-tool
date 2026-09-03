import {
  type Camera,
  Matrix4,
  type Mesh,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from 'three';
import { computeContentBox, isScaffoldName, type OrbitLike } from '../cameraCommands';
import type { NavlibViewAccessors } from './types';

/** Live per-frame handles for the active canvas. */
export interface NavlibViewDeps {
  camera: Camera;
  controls: OrbitLike;
  scene: Object3D;
  invalidate: () => void;
}

// Column-major, matching THREE's Matrix4.toArray().
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// App coordinate system for a Z-up canvas (X right, Z up, Y into the screen).
const Z_UP = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];

/** The app's previews are Z-up; a Y-up canvas is possible, so read the up axis. */
function isZUp(d: NavlibViewDeps | null): boolean {
  return !!d && Math.abs(d.camera.up.z) > 0.9;
}

function isTextMaterial(material: Mesh['material'] | undefined): boolean {
  const list = Array.isArray(material) ? material : [material];
  return list.some(
    (m) => (m as { isTroikaTextMaterial?: boolean } | undefined)?.isTroikaTextMaterial === true
  );
}

/**
 * A real surface to pivot on. Fat lines extend Mesh but are screen-space strokes
 * (dimensions, split lines) and troika text is an annotation, so a pivot on
 * either is meaningless.
 */
function isPivotTarget(obj: Object3D): obj is Mesh {
  const o = obj as Partial<Mesh> & { isLineSegments2?: boolean };
  if (o.isMesh !== true || o.isLineSegments2 === true || isTextMaterial(o.material)) return false;
  return !isScaffoldName(obj.name);
}

/**
 * The camera read/write surface the driver drives, over whatever canvas is
 * currently active (`getDeps` returns null when none is). Matrix conventions
 * follow the SDK's THREE.js sample: `view.affine` is the camera's world matrix,
 * column-major, so it round-trips through `Matrix4` with no basis change.
 */
export function createNavlibViewAccessors(
  getDeps: () => NavlibViewDeps | null
): NavlibViewAccessors {
  const look = {
    origin: new Vector3(),
    direction: new Vector3(),
    aperture: 0.01,
    selectionOnly: false,
  };
  const raycaster = new Raycaster();
  const tmpMatrix = new Matrix4();
  const tmpForward = new Vector3();

  return {
    getViewMatrix() {
      const d = getDeps();
      if (!d) return IDENTITY.slice();
      d.camera.updateMatrixWorld();
      return d.camera.matrixWorld.toArray();
    },
    setViewMatrix(data) {
      const d = getDeps();
      if (!d) return;
      const prevDist = d.camera.position.distanceTo(d.controls.target) || 1;
      tmpMatrix.fromArray(data);
      tmpMatrix.decompose(d.camera.position, d.camera.quaternion, d.camera.scale);
      d.camera.updateMatrixWorld(true);
      // Keep OrbitControls' target in front of the camera so mouse orbit resumes
      // cleanly after the puck moves it.
      tmpForward.set(0, 0, -1).applyQuaternion(d.camera.quaternion);
      d.controls.target.copy(d.camera.position).addScaledVector(tmpForward, prevDist);
      d.controls.update();
    },
    getPerspective() {
      const d = getDeps();
      return d ? d.camera instanceof PerspectiveCamera : true;
    },
    getViewExtents() {
      const d = getDeps();
      if (d && d.camera instanceof OrthographicCamera) {
        const c = d.camera;
        return [c.left, c.bottom, -c.far, c.right, c.top, -c.near];
      }
      return [-1, -1, -1, 1, 1, 1];
    },
    setViewExtents(data) {
      const d = getDeps();
      if (d && d.camera instanceof OrthographicCamera) {
        const c = d.camera;
        c.left = data[0];
        c.bottom = data[1];
        c.right = data[3];
        c.top = data[4];
        // Mirror getViewExtents' encoding so the clip planes round-trip.
        c.far = -data[2];
        c.near = -data[5];
        c.updateProjectionMatrix();
      }
    },
    getViewTarget() {
      const d = getDeps();
      return d ? d.controls.target.toArray() : [0, 0, 0];
    },
    getFov() {
      const d = getDeps();
      if (d && d.camera instanceof PerspectiveCamera) return (d.camera.fov * Math.PI) / 180;
      return Math.PI / 4;
    },
    getViewFrustum() {
      const d = getDeps();
      if (d && d.camera instanceof PerspectiveCamera) {
        const c = d.camera;
        const tanHalfFov = Math.tan((c.fov * Math.PI) / 360);
        const bottom = -c.near * tanHalfFov;
        const left = bottom * c.aspect;
        return [left, -left, bottom, -bottom, c.near, c.far];
      }
      return [-1, 1, -1, 1, 0.1, 1000];
    },
    getModelExtents() {
      const d = getDeps();
      if (!d) return null;
      const box = computeContentBox(d.scene);
      if (box.isEmpty()) return null;
      return [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
    },
    getPivotPosition() {
      const d = getDeps();
      if (!d) return null;
      const box = computeContentBox(d.scene);
      if (box.isEmpty()) return null;
      return box.getCenter(new Vector3()).toArray();
    },
    getCoordinateSystem() {
      return isZUp(getDeps()) ? Z_UP.slice() : IDENTITY.slice();
    },
    getFrontView() {
      // Front view = the app's world pose expressed in its coordinate system.
      return isZUp(getDeps()) ? Z_UP.slice() : IDENTITY.slice();
    },
    getConstructionPlane() {
      // Ground plane through the origin, normal along the up axis.
      return isZUp(getDeps()) ? [0, 0, 1, 0] : [0, 1, 0, 0];
    },
    getFloorPlane() {
      return isZUp(getDeps()) ? [0, 0, 1, 0] : [0, 1, 0, 0];
    },
    getViewRotatable() {
      const d = getDeps();
      return d ? d.controls.enableRotate !== false : true;
    },
    setLookFrom(data) {
      look.origin.set(data[0], data[1], data[2]);
    },
    setLookDirection(data) {
      look.direction.set(data[0], data[1], data[2]);
    },
    setLookAperture(data) {
      look.aperture = data;
    },
    setSelectionOnly(data) {
      look.selectionOnly = data;
    },
    getLookAt() {
      const d = getDeps();
      // No selection set exists in this app, so a selection-only probe never hits.
      if (!d || look.selectionOnly || look.direction.lengthSq() === 0) return null;
      // look.aperture is an angular point/line picking tolerance, which does not
      // apply to the solid meshes we cast against.
      raycaster.set(look.origin, tmpForward.copy(look.direction).normalize());
      // Some Mesh subclasses (fat lines) read raycaster.camera; isPivotTarget
      // skips the ones we know of, the camera covers any the scene gains later.
      raycaster.camera = d.camera;
      const candidates: Object3D[] = [];
      d.scene.traverseVisible((obj) => {
        if (isPivotTarget(obj)) candidates.push(obj);
      });
      const hits = raycaster.intersectObjects(candidates, false);
      return hits.length > 0 ? hits[0].point.toArray() : null;
    },
    getPointerPosition() {
      // Pointer-anchored pivot is not wired up; the driver falls back to the
      // model pivot from getPivotPosition.
      return null;
    },
    invalidate() {
      getDeps()?.invalidate();
    },
  };
}
