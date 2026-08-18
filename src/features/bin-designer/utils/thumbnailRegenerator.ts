/**
 * Offscreen thumbnail regenerator for the Bin Designer.
 *
 * Generates thumbnails for designs that don't have one (or have an outdated version)
 * by creating an offscreen Three.js renderer, generating the mesh via a worker,
 * and capturing a snapshot from the standard isometric angle.
 *
 * Acquires the shared bridge via BridgeManager (reusing the existing instance
 * if one is active) and releases it when done.
 */

import type { WebGLRenderer, BufferGeometry, MeshStandardMaterial } from 'three';
import { bridgeManager } from '@/shared/generation/bridge';
import type { BinParams } from '@/features/bin-designer/types';
import { LID_FIT_CLEARANCE, resolveLidCavityExtraMm } from '@/features/bin-designer/types';
import { ISOMETRIC_DIRECTION, calculateIdealDistance } from './cameraFraming';
import { THREE_COLORS } from '@/shared/hooks/useThemeEffect';
import {
  binLipTopWorldZ,
  lidAnchorZ,
} from '@/features/bin-designer/components/preview/LidMesh/lidAnchorZ';
import { knifeRestGroupPosition } from '@/features/bin-designer/components/preview/KnifeRestMesh/knifeRestPlacement';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';

/** Thumbnail size matching the main capture utility */
const THUMBNAIL_SIZE = 384;

/** Default preview color matching PreviewCanvas default */
const DEFAULT_COLOR = '#d4d8dc';

interface RegenerateOptions {
  /** AbortSignal to cancel the operation. */
  readonly signal?: AbortSignal;
  /** Preview color override. Defaults to `DEFAULT_COLOR`. */
  readonly color?: string;
}

/**
 * Generate a thumbnail for a bin design using an offscreen Three.js renderer.
 *
 * Creates a temporary WebGL context, generates mesh via a worker, renders one frame,
 * and returns a WebP data URL. All resources are cleaned up after capture.
 *
 * @param params - Bin parameters to generate and render
 * @param options - Optional abort signal and preview color override
 * @returns WebP data URL string, or null on failure
 */
export async function regenerateThumbnail(
  params: BinParams,
  options: RegenerateOptions = {}
): Promise<string | null> {
  const { signal, color = DEFAULT_COLOR } = options;
  // three is loaded on demand: this offscreen renderer only runs during background
  // thumbnail regeneration (idle time), so three core stays out of the eager bundle.
  const THREE = await import('three');
  let renderer: WebGLRenderer | null = null;
  // Track whether `acquire()` actually returned before incrementing the
  // bridge's ref-count obligation on our side. BridgeManager.acquire()
  // decrements its own refCount on init failure, so a blanket `release()`
  // in `finally` would double-decrement and drop any outer caller's hold
  // — notably `runBatch`, which pre-acquires the bridge for a whole batch.
  let bridgeAcquired = false;

  try {
    const bridge = await bridgeManager.acquire();
    bridgeAcquired = true;

    if (signal?.aborted) return null;

    const result = await bridge.generateImmediate(params);
    if (signal?.aborted) return null;

    const { vertices, normals, indices, edgeVertices, lidMesh, detachableFeetMesh, knifeRestMesh } =
      result.mesh;
    if (vertices.length === 0) return null;

    // Build geometry. The worker emits an indexed mesh (deduplicated vertices
    // + Uint32 index buffer); without setIndex, Three.js treats `vertices`
    // as a non-indexed triangle list and renders garbage triangles.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (indices.length > 0) {
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    if (normals.length > 0) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geometry.computeVertexNormals();
    }

    // Build edge geometry from pre-computed BREP edges (from worker)
    let edgesGeometry: BufferGeometry | null = null;
    if (edgeVertices.length > 0) {
      edgesGeometry = new THREE.BufferGeometry();
      edgesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
    }

    // Detachable feet, assembled under the bin. Without them the card shows a
    // flat-bottomed box, which is not the object the design describes.
    let feetGeometry: BufferGeometry | null = null;
    let feetEdgesGeometry: BufferGeometry | null = null;
    if (detachableFeetMesh && detachableFeetMesh.vertices.length > 0) {
      feetGeometry = new THREE.BufferGeometry();
      feetGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(detachableFeetMesh.vertices, 3)
      );
      if (detachableFeetMesh.indices.length > 0) {
        feetGeometry.setIndex(new THREE.BufferAttribute(detachableFeetMesh.indices, 1));
      }
      if (detachableFeetMesh.normals.length > 0) {
        feetGeometry.setAttribute(
          'normal',
          new THREE.Float32BufferAttribute(detachableFeetMesh.normals, 3)
        );
      } else {
        feetGeometry.computeVertexNormals();
      }
      if (detachableFeetMesh.edgeVertices.length > 0) {
        feetEdgesGeometry = new THREE.BufferGeometry();
        feetEdgesGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(detachableFeetMesh.edgeVertices, 3)
        );
      }
    }

    // Knife handle rest, standing beside the block. It arrives in its own
    // print frame, so unlike the feet it needs the mated step — from the same
    // helper the live preview places it with.
    const restPlan = knifeRestMesh ? planKnifeRest(params) : null;
    const restPosition = restPlan ? knifeRestGroupPosition(params, restPlan, 0) : null;
    let restGeometry: BufferGeometry | null = null;
    let restEdgesGeometry: BufferGeometry | null = null;
    if (knifeRestMesh && restPosition && knifeRestMesh.vertices.length > 0) {
      restGeometry = new THREE.BufferGeometry();
      restGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(knifeRestMesh.vertices, 3)
      );
      if (knifeRestMesh.indices.length > 0) {
        restGeometry.setIndex(new THREE.BufferAttribute(knifeRestMesh.indices, 1));
      }
      if (knifeRestMesh.normals.length > 0) {
        restGeometry.setAttribute(
          'normal',
          new THREE.Float32BufferAttribute(knifeRestMesh.normals, 3)
        );
      } else {
        restGeometry.computeVertexNormals();
      }
      if (knifeRestMesh.edgeVertices.length > 0) {
        restEdgesGeometry = new THREE.BufferGeometry();
        restEdgesGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(knifeRestMesh.edgeVertices, 3)
        );
      }
    }

    // Lid mesh + edges (rendered at closed position when params.lid.enabled
    // and the worker produced a lid). Matches LidMesh.tsx's mated formula.
    let lidGeometry: BufferGeometry | null = null;
    let lidEdgesGeometry: BufferGeometry | null = null;
    const lidGroupZ =
      lidMesh && params.lid.enabled && params.base.stackingLip
        ? binLipTopWorldZ(params) -
          lidAnchorZ(params.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(params))
        : null;
    if (lidMesh && lidGroupZ !== null && lidMesh.vertices.length > 0) {
      lidGeometry = new THREE.BufferGeometry();
      lidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lidMesh.vertices, 3));
      if (lidMesh.indices.length > 0) {
        lidGeometry.setIndex(new THREE.BufferAttribute(lidMesh.indices, 1));
      }
      if (lidMesh.normals.length > 0) {
        lidGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(lidMesh.normals, 3));
      } else {
        lidGeometry.computeVertexNormals();
      }
      if (lidMesh.edgeVertices.length > 0) {
        lidEdgesGeometry = new THREE.BufferGeometry();
        lidEdgesGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(lidMesh.edgeVertices, 3)
        );
      }
    }

    // Check abort before expensive scene setup and rendering
    if (signal?.aborted) {
      geometry.dispose();
      edgesGeometry?.dispose();
      lidGeometry?.dispose();
      lidEdgesGeometry?.dispose();
      feetGeometry?.dispose();
      feetEdgesGeometry?.dispose();
      restGeometry?.dispose();
      restEdgesGeometry?.dispose();
      return null;
    }

    // Create scene matching PreviewCanvas setup
    const scene = new THREE.Scene();

    const palette =
      document.documentElement.dataset.theme === 'light' ? THREE_COLORS.light : THREE_COLORS.dark;
    scene.background = new THREE.Color(palette.gradientTop);

    // 3-point lighting matching PreviewCanvas
    const hemiLight = new THREE.HemisphereLight('#ffffff', palette.groundBounce, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fff8f0', 0.85);
    keyLight.position.set(-50, 60, 80);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#e0e8ff', 0.15);
    fillLight.position.set(40, -40, 30);
    scene.add(fillLight);

    // Bin mesh with PBR material matching BinMesh component
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.08,
      flatShading: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0.1);
    scene.add(mesh);

    // Edge lines from pre-computed BREP topology
    const edgeMaterial = new THREE.LineBasicMaterial({ color: '#000000' });
    if (edgesGeometry) {
      const edges = new THREE.LineSegments(edgesGeometry, edgeMaterial);
      edges.position.set(0, 0, 0.1);
      edges.renderOrder = 1;
      scene.add(edges);
    }

    // Lid mesh rendered at its closed/mated position (lidOffsetMm = 0). Opaque
    // here — there's no exploded-view affordance in a thumbnail, so the lid
    // simply hides the cavity it sits over.
    let lidMaterial: MeshStandardMaterial | null = null;
    // The feet arrive positioned in the bin's own frame, so the only transform
    // they need is the scene-wide nudge the body and its edges already take —
    // without it they render 0.1mm below the body they are attached to, and
    // their edges lose the renderOrder that keeps them off the surface.
    if (feetGeometry) {
      const feetPart = new THREE.Mesh(feetGeometry, material);
      feetPart.position.set(0, 0, 0.1);
      scene.add(feetPart);
      if (feetEdgesGeometry) {
        const feetEdges = new THREE.LineSegments(feetEdgesGeometry, edgeMaterial);
        feetEdges.position.set(0, 0, 0.1);
        feetEdges.renderOrder = 1;
        scene.add(feetEdges);
      }
    }

    if (restGeometry && restPosition) {
      const rest = new THREE.Mesh(restGeometry, material);
      rest.position.set(restPosition[0], restPosition[1], restPosition[2]);
      scene.add(rest);
      if (restEdgesGeometry) {
        const restEdges = new THREE.LineSegments(restEdgesGeometry, edgeMaterial);
        restEdges.position.set(restPosition[0], restPosition[1], restPosition[2]);
        restEdges.renderOrder = 1;
        scene.add(restEdges);
      }
    }

    if (lidGeometry && lidGroupZ !== null) {
      lidMaterial = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.08,
        flatShading: false,
        polygonOffset: true,
        polygonOffsetFactor: 4,
        polygonOffsetUnits: 4,
      });
      const lid = new THREE.Mesh(lidGeometry, lidMaterial);
      lid.position.set(0, 0, lidGroupZ);
      scene.add(lid);
      if (lidEdgesGeometry) {
        const lidEdges = new THREE.LineSegments(lidEdgesGeometry, edgeMaterial);
        lidEdges.position.set(0, 0, lidGroupZ);
        lidEdges.renderOrder = 1;
        scene.add(lidEdges);
      }
    }

    // Camera setup
    const fov = 45;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 2000);
    camera.up.set(0, 0, 1);

    const { width, depth, height, gridUnitMm, gridUnitMmY, heightUnitMm } = params;
    const totalH = height * heightUnitMm;
    const binCenter = new THREE.Vector3(0, 0, totalH / 2);
    // The rest stands OUTSIDE the block's footprint, so framing the block
    // alone crops the companion off the card. Framed as if the block were wide
    // enough to reach the rest's far edge, since the camera still targets the
    // block's centre.
    const restAlongX = restPlan !== null && (restPlan.side === 'left' || restPlan.side === 'right');
    const restReachMm =
      restPlan && restPosition && restGeometry
        ? Math.abs(restAlongX ? restPosition[0] : restPosition[1]) +
          (restPlan.alongU * (restAlongX ? gridUnitMm : (gridUnitMmY ?? gridUnitMm))) / 2
        : 0;
    const framedWidth =
      restAlongX && restReachMm > 0 ? Math.max(width, (2 * restReachMm) / gridUnitMm) : width;
    const framedDepth =
      !restAlongX && restReachMm > 0
        ? Math.max(depth, (2 * restReachMm) / (gridUnitMmY ?? gridUnitMm))
        : depth;
    const idealDistance = calculateIdealDistance(
      framedWidth,
      framedDepth,
      height,
      fov,
      gridUnitMm,
      heightUnitMm,
      gridUnitMmY ?? gridUnitMm
    );

    const cameraPos = new THREE.Vector3(
      ISOMETRIC_DIRECTION.x,
      ISOMETRIC_DIRECTION.y,
      ISOMETRIC_DIRECTION.z
    )
      .multiplyScalar(idealDistance)
      .add(binCenter);
    camera.position.copy(cameraPos);
    camera.lookAt(binCenter);
    camera.updateProjectionMatrix();

    // Create offscreen renderer
    const canvas = document.createElement('canvas');
    canvas.width = THUMBNAIL_SIZE;
    canvas.height = THUMBNAIL_SIZE;

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    renderer.setSize(THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    // Render one frame
    renderer.render(scene, camera);

    // Capture as WebP
    const dataUrl = canvas.toDataURL('image/webp', 0.9);

    // Clean up Three.js objects
    geometry.dispose();
    edgesGeometry?.dispose();
    lidGeometry?.dispose();
    lidEdgesGeometry?.dispose();
    feetGeometry?.dispose();
    feetEdgesGeometry?.dispose();
    restGeometry?.dispose();
    restEdgesGeometry?.dispose();
    material.dispose();
    lidMaterial?.dispose();
    edgeMaterial.dispose();
    scene.clear();

    return dataUrl;
  } catch {
    return null;
  } finally {
    if (bridgeAcquired) {
      bridgeManager.release();
    }
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
}
