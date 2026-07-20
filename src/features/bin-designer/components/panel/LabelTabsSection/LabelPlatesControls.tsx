/**
 * Swappable label plate controls for socket-mode label tabs (#2666, PR 2):
 * the derived plate list, a pre-export 3D preview, and the export dialog.
 * The plate set comes from the same socket plan the worker cuts, so what's
 * listed here is exactly what prints.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Badge, Button, Dialog } from '@/design-system';
import { ExportDialog } from '@/shared/components/ExportDialog';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isErr } from '@/core/result';
import { FORMAT_EXTENSIONS } from '@/shared/generation/exportUtils';
import { getErrorMessage } from '@/shared/utils/errors';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';
import { useLabelPlateExport, LABEL_PLATES_BASE_NAME } from '../../../hooks/useLabelPlateExport';

interface PreviewMesh {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
}

function PlatesMesh({ mesh: data }: { mesh: PreviewMesh }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.vertices, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    g.center();
    return g;
  }, [data]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#8899aa" roughness={0.6} metalness={0.05} />
    </mesh>
  );
}

export function LabelPlatesControls() {
  const t = useTranslation();
  const { plates, isExporting, canExport, downloadPlates, fetchPreviewStl } = useLabelPlateExport();

  const [exportOpen, setExportOpen] = useState(false);
  const [fileNameConfig, setFileNameConfig] = useState<ExportFileNameConfig>({
    style: 'descriptive',
    customName: '',
    format: 'stl',
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMesh, setPreviewMesh] = useState<PreviewMesh | null>(null);

  const activeFormat: ExportFileFormat = fileNameConfig.format ?? 'stl';
  const baseName =
    fileNameConfig.style === 'custom' && fileNameConfig.customName.trim() !== ''
      ? fileNameConfig.customName.trim()
      : LABEL_PLATES_BASE_NAME;

  const handleDownload = useCallback(() => {
    void downloadPlates(activeFormat, baseName).then((succeeded) => {
      if (!succeeded) return;
      useToastStore.getState().addToast(t('binDesigner.plates.exportComplete'), 'success', 3000);
      setExportOpen(false);
    });
  }, [downloadPlates, activeFormat, baseName, t]);

  // Preview requests are token-guarded: closing and reopening while a fetch
  // is in flight must not let the stale resolution overwrite (or close) the
  // newer preview.
  const previewTokenRef = useRef(0);

  const closePreview = useCallback(() => {
    previewTokenRef.current++;
    setPreviewOpen(false);
    setPreviewMesh(null);
  }, []);

  const openPreview = useCallback(() => {
    const token = ++previewTokenRef.current;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewMesh(null);
    void fetchPreviewStl()
      .then((data) => {
        if (token !== previewTokenRef.current) return;
        const parsed = data ? parseSTLBinary(data) : null;
        if (!parsed || isErr(parsed)) {
          useToastStore.getState().addToast(t('binDesigner.plates.exportFailed'), 'error');
          setPreviewOpen(false);
          return;
        }
        setPreviewMesh({ vertices: parsed.value.vertices, normals: parsed.value.normals });
      })
      .catch((error: unknown) => {
        if (token !== previewTokenRef.current) return;
        useToastStore
          .getState()
          .addToast(getErrorMessage(error, t('binDesigner.plates.exportFailed')), 'error');
        setPreviewOpen(false);
      })
      .finally(() => {
        if (token === previewTokenRef.current) setPreviewLoading(false);
      });
  }, [fetchPreviewStl, t]);

  if (plates.length === 0) return null;

  return (
    <div>
      <span className="mb-1 flex items-center gap-2 text-xs font-medium text-content-secondary">
        {t('binDesigner.plates.title')}
        <Badge>{plates.length}</Badge>
      </span>
      <ul className="mb-2 flex flex-col gap-0.5">
        {plates.map((plate, i) => {
          // Technical readout, deliberately untranslated (dimensionsReadout
          // convention).
          const widthLabel = `${plate.widthU}U`;
          return (
            <li key={i} className="flex items-center gap-2 text-xs text-content-tertiary">
              <span className="w-8 shrink-0 tabular-nums">{widthLabel}</span>
              <span className="truncate">
                {plate.text.length > 0 ? plate.text : `(${t('binDesigner.plates.blank')})`}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" fullWidth onClick={openPreview} disabled={!canExport}>
          {t('binDesigner.plates.preview')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => setExportOpen(true)}
          disabled={!canExport}
        >
          {t('binDesigner.plates.export')}
        </Button>
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        activeFormat={activeFormat}
        fileNameConfig={fileNameConfig}
        onFileNameConfigChange={setFileNameConfig}
        fileName={`${baseName}${FORMAT_EXTENSIONS[activeFormat]}`}
        displayExtension={FORMAT_EXTENSIONS[activeFormat]}
        canExport={canExport}
        isExporting={isExporting}
        onDownload={handleDownload}
        sectionTitle={t('binDesigner.plates.dialogTitle')}
        sectionDescription={t('binDesigner.plates.dialogDescription')}
      />

      <Dialog.Root open={previewOpen} onClose={closePreview} size="md">
        <Dialog.Header
          title={t('binDesigner.plates.previewTitle')}
          closeAriaLabel={t('common.closeDialog')}
        />
        <Dialog.Body>
          <div className="h-64 w-full overflow-hidden rounded-md border border-stroke-subtle bg-surface">
            {previewLoading && (
              <p className="flex h-full items-center justify-center text-xs text-content-tertiary">
                {t('binDesigner.plates.previewLoading')}
              </p>
            )}
            {!previewLoading && previewMesh && (
              <Canvas camera={{ position: [0, -60, 60], up: [0, 0, 1], fov: 35 }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[40, -40, 80]} intensity={1.2} />
                <PlatesMesh mesh={previewMesh} />
                <OrbitControls enablePan={false} />
              </Canvas>
            )}
          </div>
        </Dialog.Body>
      </Dialog.Root>
    </div>
  );
}
