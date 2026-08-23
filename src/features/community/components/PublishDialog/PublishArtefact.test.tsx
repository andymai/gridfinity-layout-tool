import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesignLineage } from '@/shared/types/community';
import { PublishArtefact } from './PublishArtefact';
import type { PublishArtefactProps } from './PublishArtefact';

const params = {
  width: 2,
  depth: 4,
  height: 4,
  gridUnitMm: 42,
  heightUnitMm: 7,
  wallThickness: 1.2,
  compartments: { cells: [0, 0] },
  walls: { enabled: false },
  scoop: { enabled: true },
  label: { enabled: false },
  style: 'standard',
  lid: { enabled: false },
  handles: { enabled: false },
  cellMask: undefined,
  wallPattern: { enabled: false },
} as unknown as BinParams;

const lineage: CommunityDesignLineage = {
  parentId: 'Parent123456',
  rootId: 'Root12345678',
  parentName: 'Parent Bin',
  parentAuthorName: 'Alice',
  rootAuthorName: 'Bob',
};

function renderArtefact(overrides: Partial<PublishArtefactProps> = {}) {
  return render(
    <PublishArtefact
      thumbnails={['data:image/webp;base64,AA==']}
      captureFailed={false}
      params={params}
      lineage={null}
      onRetryCapture={vi.fn()}
      {...overrides}
    />
  );
}

describe('PublishArtefact', () => {
  it('states the size in both units and millimetres', () => {
    renderArtefact();
    expect(screen.getByText('2×4×4')).toBeInTheDocument();
    expect(screen.getByText(/84 × 168 × 28 mm/)).toBeInTheDocument();
    expect(screen.getByText(/1\.2 mm walls/)).toBeInTheDocument();
  });

  it('lists the techniques derived from the params', () => {
    renderArtefact();
    expect(screen.getByText('Scoop')).toBeInTheDocument();
  });

  it('states an assembly size from its envelope and tags it Workshop', () => {
    renderArtefact({
      params: undefined,
      assembly: {
        envelope: {
          width: 2,
          depth: 2,
          gridUnitMm: 42,
          heightUnitMm: 7,
        },
        structure: {
          kind: 'assembly',
          schemaVersion: 1,
          base: { floorThickness: 2 },
          mirrorAxis: 'x',
          parts: [
            {
              id: 'p1',
              type: 'post',
              params: { diameter: 8, height: 40 },
              transform: { x: 42, y: 42, seatZ: 0, rotZDeg: 0 },
              children: [],
            },
          ],
        },
      } as unknown as NonNullable<PublishArtefactProps['assembly']>,
    });
    expect(screen.getByText('2×2×7')).toBeInTheDocument();
    expect(screen.getByText(/84 × 84 × 49 mm/)).toBeInTheDocument();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });

  it('omits the lineage block for an original design', () => {
    renderArtefact();
    expect(screen.queryByText(/Parent Bin/)).not.toBeInTheDocument();
  });

  it('credits the parent on a remix', () => {
    renderArtefact({ lineage });
    expect(screen.getByText(/Parent Bin/)).toBeInTheDocument();
  });

  it('credits the root only when it is a different author', () => {
    renderArtefact({ lineage });
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it('drops the root line when the root author is the parent author', () => {
    renderArtefact({ lineage: { ...lineage, rootAuthorName: 'Alice' } });
    expect(screen.getAllByText(/Alice/).length).toBe(1);
  });

  it('offers a retry when the capture failed', () => {
    const onRetryCapture = vi.fn();
    renderArtefact({ thumbnails: null, captureFailed: true, onRetryCapture });
    expect(screen.getByText('Retry preview')).toBeInTheDocument();
  });
});
