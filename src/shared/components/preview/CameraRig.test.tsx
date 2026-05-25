import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CameraRig } from './CameraRig';

// drei's camera components render Three.js cameras inside R3F; in jsdom we
// only need to confirm the rig mounts both and toggles `makeDefault` via the
// `projection` prop. Mocking drei lets us assert on the rendered output and
// the up vector that the rig passes at construction.
vi.mock('@react-three/drei', () => ({
  PerspectiveCamera: ({
    makeDefault,
    up,
  }: {
    makeDefault?: boolean;
    up?: [number, number, number];
  }) => (
    <div
      data-testid="perspective-camera"
      data-make-default={makeDefault ? 'true' : 'false'}
      data-up={up?.join(',') ?? ''}
    />
  ),
  OrthographicCamera: ({
    makeDefault,
    up,
  }: {
    makeDefault?: boolean;
    up?: [number, number, number];
  }) => (
    <div
      data-testid="orthographic-camera"
      data-make-default={makeDefault ? 'true' : 'false'}
      data-up={up?.join(',') ?? ''}
    />
  ),
}));

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    camera: {},
    size: { width: 800, height: 600 },
    invalidate: vi.fn(),
  }),
}));

describe('CameraRig', () => {
  it('marks the perspective camera as default when projection=perspective', () => {
    const { getByTestId } = render(
      <CameraRig projection="perspective" initialPosition={[100, -100, 80]} />
    );
    expect(getByTestId('perspective-camera').getAttribute('data-make-default')).toBe('true');
    expect(getByTestId('orthographic-camera').getAttribute('data-make-default')).toBe('false');
  });

  it('marks the orthographic camera as default when projection=orthographic', () => {
    const { getByTestId } = render(
      <CameraRig projection="orthographic" initialPosition={[100, -100, 80]} />
    );
    expect(getByTestId('perspective-camera').getAttribute('data-make-default')).toBe('false');
    expect(getByTestId('orthographic-camera').getAttribute('data-make-default')).toBe('true');
  });

  it('passes Z-up to both cameras so OrbitControls binds against the correct up vector', () => {
    const { getByTestId } = render(
      <CameraRig projection="perspective" initialPosition={[100, -100, 80]} />
    );
    expect(getByTestId('perspective-camera').getAttribute('data-up')).toBe('0,0,1');
    expect(getByTestId('orthographic-camera').getAttribute('data-up')).toBe('0,0,1');
  });
});
