/**
 * Offscreen thumbnail regenerator for the Bin Designer.
 *
 * Generates thumbnails for designs that don't have one (or have an outdated version)
 * by creating an offscreen Three.js renderer, generating the mesh via a worker,
 * and capturing a snapshot from the standard isometric angle.
 *
 * Designed to run one design at a time in the background.
 */

import * as THREE from 'three';
import { GenerationBridge } from '@/shared/generation/bridge';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import type { BinParams } from '@/features/bin-designer/types';
import { ISOMETRIC_DIRECTION, calculateIdealDistance } from './cameraFraming';

/** Thumbnail size matching the main capture utility */
const THUMBNAIL_SIZE = 384;

/** Default preview color matching PreviewCanvas default */
const DEFAULT_COLOR = '#d4d8dc';

/** Edge detection angle threshold matching BinMesh */
const EDGE_THRESHOLD = 12;

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
  const bridge = new GenerationBridge();
  let renderer: THREE.WebGLRenderer | null = null;

  try {
    // Initialize worker and generate mesh
    await bridge.init();
    if (signal?.aborted) return null;

    const result = await bridge.generateImmediate(params);
    if (signal?.aborted) return null;

    const { vertices, normals } = result.mesh;
    if (!vertices || vertices.length === 0) return null;

    // Build geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (normals && normals.length > 0) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geometry.computeVertexNormals();
    }

    // Build edge geometry for sketch-like appearance
    const edgesGeometry = new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD);

    // Check abort before expensive scene setup and rendering
    if (signal?.aborted) {
      geometry.dispose();
      edgesGeometry.dispose();
      return null;
    }

    // Create scene matching PreviewCanvas setup
    const scene = new THREE.Scene();

    // Gradient background (solid dark since it's a single color in current implementation)
    scene.background = new THREE.Color('#2a2a3e');

    // 3-point lighting matching PreviewCanvas
    const hemiLight = new THREE.HemisphereLight('#ffffff', '#1a1a2e', 0.65);
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
      flatShading: !(normals && normals.length > 0),
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0.1);
    scene.add(mesh);

    // Edge lines
    const edgeMaterial = new THREE.LineBasicMaterial({ color: '#000000' });
    const edges = new THREE.LineSegments(edgesGeometry, edgeMaterial);
    edges.position.set(0, 0, 0.1);
    edges.renderOrder = 1;
    scene.add(edges);

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
    edgesGeometry.dispose();
    material.dispose();
    edgeMaterial.dispose();
    scene.clear();

    return dataUrl;
  } catch {
    return null;
  } finally {
    // Always clean up
    bridge.destroy();
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
}
