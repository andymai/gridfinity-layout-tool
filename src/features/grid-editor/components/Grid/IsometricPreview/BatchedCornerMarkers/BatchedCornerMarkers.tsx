import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { cornerMarkerPositions, type CornerMarkerBin } from './cornerMarkerPositions';

const LINE_OPACITY = 0.4;

interface BatchedCornerMarkersProps {
  bins: CornerMarkerBin[];
}

/**
 * Batched corner markers for all bins in a single geometry.
 * Reduces 200 draw calls to 1 by combining all line segments.
 */
export function BatchedCornerMarkers({ bins }: BatchedCornerMarkersProps) {
  const colors = useThreeColors();
  const geometry = useMemo(() => {
    const positions = cornerMarkerPositions(bins);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [bins]);

  // Cleanup geometry on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (bins.length === 0) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={colors.lineColor} transparent opacity={LINE_OPACITY} />
    </lineSegments>
  );
}
