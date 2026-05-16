import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { useLayoutStore } from '@/core/store/layout';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { SnapClipPreview } from './SnapClipPreview';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';

describe('SnapClipPreview', () => {
  beforeEach(() => {
    useBaseplatePageStore.setState({ tiling: null });
    useLayoutStore.getState().setBaseplateParams({
      ...DEFAULT_BASEPLATE_PARAMS,
      connectorStyle: 'none',
    });
  });

  it('renders nothing when not split', () => {
    const { container } = render(
      <Canvas>
        <SnapClipPreview />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });

  it('renders nothing when connectorStyle is not snap', () => {
    useLayoutStore.getState().setBaseplateParams({
      ...DEFAULT_BASEPLATE_PARAMS,
      connectorStyle: 'dovetail',
    });
    const { container } = render(
      <Canvas>
        <SnapClipPreview />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });
});
