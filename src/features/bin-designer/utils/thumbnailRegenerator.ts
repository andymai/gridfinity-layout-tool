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

import * as THREE from 'three';
import { bridgeManager } from '@/shared/generation/bridge';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import type { BinParams } from '@/features/bin-designer/types';
import { ISOMETRIC_DIRECTION, calculateIdealDistance } from './cameraFraming';
import { THREE_COLORS } from '@/shared/hooks/useThemeEffect';

/** Thumbnail size matching the main capture utility */
const THUMBNAIL_SIZE = 384;

/** Default preview color matching PreviewCanvas default */
const DEFAULT_COLOR = '#d4d8dc';

/**
 * Generate a thumbnail for a bin design using an offscreen Three.js renderer.
 *
 * Creates a temporary WebGL context, generates mesh via a worker, renders one frame,
 * and returns a WebP data URL. All resources are cleaned up after capture.
 *
 * @param params - Bin parameters to generate and render
 * @param signal - Optional AbortSignal to cancel the operation
 * @returns WebP data URL string, or null on failure
 */
export async function regenerateThumbnail(
  params: BinParams,
  signal?: AbortSignal
): Promise<string | null> {
  let renderer: THREE.WebGLRenderer | null = null;

  try {
    const bridge = await bridgeManager.acquire();

    if (signal?.aborted) return null;

    const result = await bridge.generateImmediate(params);
    if (signal?.aborted) return null;

    const { vertices, normals, edgeVertices } = result.mesh;
    if (vertices.length === 0) return null;

    // Build geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (normals.length > 0) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geometry.computeVertexNormals();
    }

    // Build edge geometry from pre-computed BREP edges (from worker)
    let edgesGeometry: THREE.BufferGeometry | null = null;
    if (edgeVertices.length > 0) {
      edgesGeometry = new THREE.BufferGeometry();
      edgesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
    }

    // Check abort before expensive scene setup and rendering
    if (signal?.aborted) {
      geometry.dispose();
      edgesGeometry?.dispose();
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
      color: DEFAULT_COLOR,
      roughness: 0.45,
      metalness: 0,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(DEFAULT_COLOR),
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

    // Camera setup
    const fov = 45;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 2000);
    camera.up.set(0, 0, 1);

    const { width, depth, height } = params;
    const totalH = height * GRIDFINITY.HEIGHT_UNIT;
    const binCenter = new THREE.Vector3(0, 0, totalH / 2);
    const idealDistance = calculateIdealDistance(width, depth, height, fov);

    const cameraPos = ISOMETRIC_DIRECTION.clone().multiplyScalar(idealDistance).add(binCenter);
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
    material.dispose();
    edgeMaterial.dispose();
    scene.clear();

    return dataUrl;
  } catch {
    return null;
  } finally {
    bridgeManager.release();
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
}
