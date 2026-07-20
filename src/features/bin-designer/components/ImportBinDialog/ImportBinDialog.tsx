/**
 * Confirmation dialog for importing a whole Gridfinity bin STL as a design.
 *
 * Shows the decimated, auto-laid-flat mesh in a small 3D viewer with per-axis
 * rotation controls (every change re-runs the worker pipeline on the retained
 * file buffer), the detected grid footprint as adjustable W×D×H steppers, and
 * an off-grid warning when the mesh deviates from the snapped Gridfinity
 * dimensions. mm are physical — the mesh is never scaled; the steppers change
 * only the CLAIMED footprint used by the layout planner.
 */

import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Center, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Button, Dialog, Stepper } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { MeshImportRotation } from '@/shared/generation/meshAsset';
import { OFF_GRID_WARNING_MM } from '@/features/bin-designer/utils/meshGridDetection';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import type { GridClaim, PendingBinImport } from './useImportBinDesign';

const ROTATION_AXES: readonly (keyof MeshImportRotation)[] = ['x', 'y', 'z'];
const ROTATION_STEP_DEG = 90;

interface ImportBinDialogProps {
  readonly pending: PendingBinImport | null;
  readonly importing: boolean;
  readonly claim: GridClaim;
  readonly onClaimChange: (claim: GridClaim) => void;
  readonly onRotate: (axis: keyof MeshImportRotation, degrees: number) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

function LabeledStepper({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-content-secondary">{label}</span>
      {children}
    </div>
  );
}

function BinPreviewMesh({ pending }: { readonly pending: PendingBinImport }) {
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

export function ImportBinDialog({
  pending,
  importing,
  claim,
  onClaimChange,
  onRotate,
  onSave,
  onCancel,
}: ImportBinDialogProps) {
  const t = useTranslation();
  if (!pending) return null;

  const { sizeMm } = pending.asset;
  const dims = `${sizeMm.x.toFixed(1)} × ${sizeMm.y.toFixed(1)} × ${sizeMm.z.toFixed(1)} mm`;
  const maxDim = Math.max(sizeMm.x, sizeMm.y, sizeMm.z);

  return (
    <Dialog.Root open onClose={onCancel} size="md">
      <Dialog.Header title={t('binDesigner.importBin.title')} />
      <Dialog.Body>
        <div className="flex flex-col gap-3">
          <div className="relative h-64 rounded-lg border border-stroke-subtle bg-surface-sunken overflow-hidden">
            <Canvas camera={{ position: [maxDim, maxDim, maxDim], up: [0, 0, 1], fov: 40 }}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[1, 2, 3]} intensity={1.2} />
              <directionalLight position={[-2, -1, 1]} intensity={0.4} />
              <BinPreviewMesh pending={pending} />
              <OrbitControls makeDefault enablePan={false} />
            </Canvas>
            {importing && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/60 text-sm text-content-secondary">
                {t('binDesigner.cutouts.stlImport.processing')}
              </div>
            )}
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="text-sm text-content-secondary">
              <div className="font-medium text-content">{pending.asset.name}</div>
              <div>
                {dims} ·{' '}
                {t('binDesigner.cutouts.stlImport.triangles', {
                  count: pending.asset.triangleCount,
                })}
              </div>
              {pending.detected.hasLip && (
                <div className="text-xs text-content-tertiary">
                  {t('binDesigner.importBin.lipDetected')}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {ROTATION_AXES.map((axis) => (
                <div key={axis} className="flex items-center justify-end gap-1.5">
                  <span className="w-3 text-xs font-medium text-content-secondary">
                    {axis.toUpperCase()}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={importing}
                    onClick={() => onRotate(axis, pending.rotation[axis] + ROTATION_STEP_DEG)}
                    aria-label={t('binDesigner.cutouts.stlImport.flipAxis', {
                      axis: axis.toUpperCase(),
                    })}
                  >
                    {t('binDesigner.cutouts.stlImport.flipAxis', { axis: axis.toUpperCase() })}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3">
            <LabeledStepper label={t('binDesigner.importBin.widthUnits')}>
              <Stepper
                size="sm"
                aria-label={t('binDesigner.importBin.widthUnits')}
                value={claim.width}
                onChange={(v) => onClaimChange({ ...claim, width: v })}
                onStep={(delta) =>
                  onClaimChange({
                    ...claim,
                    width: claim.width + delta * DESIGNER_CONSTRAINTS.DIMENSION_STEP,
                  })
                }
                min={DESIGNER_CONSTRAINTS.MIN_DIMENSION}
                max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
                step={DESIGNER_CONSTRAINTS.DIMENSION_STEP}
                disabled={importing}
              />
            </LabeledStepper>
            <LabeledStepper label={t('binDesigner.importBin.depthUnits')}>
              <Stepper
                size="sm"
                aria-label={t('binDesigner.importBin.depthUnits')}
                value={claim.depth}
                onChange={(v) => onClaimChange({ ...claim, depth: v })}
                onStep={(delta) =>
                  onClaimChange({
                    ...claim,
                    depth: claim.depth + delta * DESIGNER_CONSTRAINTS.DIMENSION_STEP,
                  })
                }
                min={DESIGNER_CONSTRAINTS.MIN_DIMENSION}
                max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
                step={DESIGNER_CONSTRAINTS.DIMENSION_STEP}
                disabled={importing}
              />
            </LabeledStepper>
            <LabeledStepper label={t('binDesigner.importBin.heightUnits')}>
              <Stepper
                size="sm"
                aria-label={t('binDesigner.importBin.heightUnits')}
                value={claim.heightUnits}
                onChange={(v) => onClaimChange({ ...claim, heightUnits: Math.round(v) })}
                onStep={(delta) =>
                  onClaimChange({ ...claim, heightUnits: claim.heightUnits + delta })
                }
                min={1}
                max={DESIGNER_CONSTRAINTS.MAX_HEIGHT}
                step={1}
                disabled={importing}
              />
            </LabeledStepper>
          </div>

          {pending.detected.offGrid && (
            <p className="text-sm text-warning" role="alert">
              {t('binDesigner.importBin.offGridWarning', { mm: OFF_GRID_WARNING_MM })}
            </p>
          )}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="primary" disabled={importing} onClick={onSave}>
          {t('binDesigner.importBin.save')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
