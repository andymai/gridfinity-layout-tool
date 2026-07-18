/**
 * Orientation confirmation dialog for STL mesh imprint import.
 *
 * Shows the decimated, auto-laid-flat tool mesh in a small 3D viewer with
 * per-axis rotation controls — free degrees via stepper/typed input plus a
 * quarter-turn button (every change re-runs the worker pipeline on the
 * retained file buffer) — the footprint dimensions, and an oversize warning
 * when the tool won't fit the current bin interior. mm are physical — the
 * mesh is never scaled.
 */

import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Center, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Dialog, Button, Stepper } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { MeshImportRotation } from '@/shared/generation/meshAsset';
import type { PendingStlImport } from './useStlImport';

const ROTATION_AXES: readonly (keyof MeshImportRotation)[] = ['x', 'y', 'z'];
const ROTATION_STEP_DEG = 15;

interface StlImportDialogProps {
  readonly pending: PendingStlImport | null;
  readonly importing: boolean;
  readonly onRotate: (axis: keyof MeshImportRotation, degrees: number) => void;
  readonly onPlace: () => void;
  readonly onCancel: () => void;
}

function ToolMesh({ pending }: { readonly pending: PendingStlImport }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pending.positions, 3));
    geo.setIndex(new THREE.BufferAttribute(pending.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [pending]);

  // Each rotation change replaces the geometry — dispose the old GPU buffers.
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <Center>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#8fa3b8" flatShading roughness={0.7} metalness={0.05} />
      </mesh>
    </Center>
  );
}

export function StlImportDialog({
  pending,
  importing,
  onRotate,
  onPlace,
  onCancel,
}: StlImportDialogProps) {
  const t = useTranslation();
  if (!pending) return null;

  const { sizeMm } = pending.asset;
  const dims = `${sizeMm.x.toFixed(1)} × ${sizeMm.y.toFixed(1)} × ${sizeMm.z.toFixed(1)} mm`;
  const maxDim = Math.max(sizeMm.x, sizeMm.y, sizeMm.z);

  return (
    <Dialog.Root open onClose={onCancel} size="md">
      <Dialog.Header title={t('binDesigner.cutouts.stlImport.title')} />
      <Dialog.Body>
        <div className="flex flex-col gap-3">
          <div className="relative h-64 rounded-lg border border-stroke-subtle bg-surface-sunken overflow-hidden">
            <Canvas camera={{ position: [maxDim, maxDim, maxDim], up: [0, 0, 1], fov: 40 }}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[1, 2, 3]} intensity={1.2} />
              <directionalLight position={[-2, -1, 1]} intensity={0.4} />
              <ToolMesh pending={pending} />
              <OrbitControls makeDefault enablePan={false} />
            </Canvas>
            {importing && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/60 text-sm text-content-secondary">
                {t('binDesigner.cutouts.stlImport.processing')}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-content-secondary">
              <div className="font-medium text-content">{pending.asset.name}</div>
              <div>
                {dims} ·{' '}
                {t('binDesigner.cutouts.stlImport.triangles', {
                  count: pending.asset.triangleCount,
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {ROTATION_AXES.map((axis) => {
                const degrees = pending.rotation[axis];
                return (
                  <div key={axis} className="flex items-center justify-end gap-1.5">
                    <span className="w-3 text-xs font-medium text-content-secondary">
                      {axis.toUpperCase()}
                    </span>
                    <Stepper
                      size="sm"
                      value={degrees}
                      onChange={(v) => onRotate(axis, v)}
                      onStep={(delta) => onRotate(axis, degrees + delta * ROTATION_STEP_DEG)}
                      min={-360}
                      max={360}
                      step={ROTATION_STEP_DEG}
                      inputDecimals={1}
                      disabled={importing}
                      aria-label={t('binDesigner.cutouts.stlImport.rotateAxis', {
                        axis: axis.toUpperCase(),
                      })}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={importing}
                      onClick={() => onRotate(axis, degrees + 90)}
                      aria-label={t('binDesigner.cutouts.stlImport.flipAxis', {
                        axis: axis.toUpperCase(),
                      })}
                    >
                      {t('binDesigner.cutouts.stlImport.flipAxis', { axis: axis.toUpperCase() })}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {pending.oversized && (
            <p className="text-sm text-warning" role="alert">
              {t('binDesigner.cutouts.stlImport.oversizeWarning')}
            </p>
          )}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="primary" disabled={importing} onClick={onPlace}>
          {t('binDesigner.cutouts.stlImport.place')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
