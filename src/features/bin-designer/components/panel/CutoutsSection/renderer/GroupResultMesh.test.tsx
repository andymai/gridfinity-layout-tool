import { afterEach, describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import polygonClipping from 'polygon-clipping';
import type { Cutout } from '@/features/bin-designer/types';
import { GroupResultMesh } from './GroupResultMesh';

const member = (overrides: Partial<Cutout>): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: 'g',
  groupOp: 'intersect',
  ...overrides,
});

describe('GroupResultMesh', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports a memoized component', () => {
    expect(typeof GroupResultMesh).toBe('object');
    expect(GroupResultMesh.$$typeof).toBeDefined();
  });

  it('renders nothing instead of throwing when the clipper fails', () => {
    vi.spyOn(polygonClipping, 'intersection').mockImplementation(() => {
      throw new Error('Unable to complete output ring');
    });
    const members = [member({ id: 'a' }), member({ id: 'b', x: 5 })];

    const { container } = render(
      <GroupResultMesh members={members} isSelected={false} binColor="#888888" />
    );

    expect(polygonClipping.intersection).toHaveBeenCalled();
    expect(container.innerHTML).toBe('');
  });
});
