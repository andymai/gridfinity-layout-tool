import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BaseplateCameraRig } from './BaseplateCameraRig';

// drei's camera components render Three.js cameras inside R3F; in jsdom we
// only need to confirm the rig mounts both and toggles `makeDefault` via the
// `projection` prop. Mocking drei lets us assert on the rendered output.
vi.mock('@react-three/drei', () => ({
  PerspectiveCamera: ({ makeDefault }: { makeDefault?: boolean }) => (
    <div data-testid="perspective-camera" data-make-default={makeDefault ? 'true' : 'false'} />
  ),
  OrthographicCamera: ({ makeDefault }: { makeDefault?: boolean }) => (
    <div data-testid="orthographic-camera" data-make-default={makeDefault ? 'true' : 'false'} />
  ),
}));

// useThree returns a stub camera/size object; useLayoutEffect runs but the
// refs are null at first render in the mocked drei components, so the sync
// body short-circuits — that's exactly what we want for the smoke test.
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    camera: {},
    size: { width: 800, height: 600 },
    invalidate: vi.fn(),
  }),
}));

describe('BaseplateCameraRig', () => {
  it('mounts both cameras and marks the perspective one as default', () => {
    const { getByTestId } = render(
      <BaseplateCameraRig projection="perspective" initialPosition={[100, -100, 80]} />
    );
    expect(getByTestId('perspective-camera').getAttribute('data-make-default')).toBe('true');
    expect(getByTestId('orthographic-camera').getAttribute('data-make-default')).toBe('false');
  });

  it('marks the orthographic camera as default when projection is orthographic', () => {
    const { getByTestId } = render(
      <BaseplateCameraRig projection="orthographic" initialPosition={[100, -100, 80]} />
    );
    expect(getByTestId('perspective-camera').getAttribute('data-make-default')).toBe('false');
    expect(getByTestId('orthographic-camera').getAttribute('data-make-default')).toBe('true');
  });
});
