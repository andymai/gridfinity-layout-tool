// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { Example3DViewer } from './Example3DViewer';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/features/bin-designer/data/examples/meshes', () => ({
  meshUrl: (id: string) => (id === 'with-mesh' ? '/bundled/with-mesh.glb' : undefined),
}));

vi.mock('@/features/bin-designer/data/examples/thumbnails', () => ({
  thumbnailUrl: () => '/bundled/thumb.png',
}));

vi.mock('@/features/bin-designer/components/preview/GradientBackground/GradientBackground', () => ({
  GradientBackground: () => <div data-testid="gradient-background" />,
}));

const glbViewerProps = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }));
vi.mock('@/shared/components/GlbViewer', () => ({
  GlbViewer: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
    glbViewerProps.current = props;
    return <div data-testid="glb-viewer">{children}</div>;
  },
}));

function makeExample(id: string): ExampleDesign {
  return {
    id,
    nameKey: 'example.name',
    descriptionKey: 'example.description',
    techniques: ['scoop'],
    tier: 'technique',
    tags: [],
    complexity: 1,
    params: { heightUnitMm: 7 },
    metrics: { width: 2, depth: 1, height: 3, gridUnitMm: 42 },
  } as unknown as ExampleDesign;
}

describe('Example3DViewer', () => {
  it('renders only the poster image when no pre-generated mesh exists', () => {
    render(<Example3DViewer example={makeExample('poster-only')} />);

    expect(screen.getByAltText('example.name')).toHaveAttribute('src', '/bundled/thumb.png');
    expect(screen.queryByTestId('glb-viewer')).not.toBeInTheDocument();
  });

  it('delegates to the shared GlbViewer with resolved urls and the local gradient', () => {
    render(<Example3DViewer example={makeExample('with-mesh')} />);

    expect(screen.getByTestId('glb-viewer')).toBeInTheDocument();
    expect(glbViewerProps.current.meshUrl).toBe('/bundled/with-mesh.glb');
    expect(glbViewerProps.current.posterUrl).toBe('/bundled/thumb.png');
    expect(glbViewerProps.current.alt).toBe('example.name');
    expect(glbViewerProps.current.loadBehavior).toBeUndefined();
    expect(screen.getByTestId('gradient-background')).toBeInTheDocument();
  });

  it('claims the SpaceMouse, since it renders in a dialog over the live preview', () => {
    render(<Example3DViewer example={makeExample('with-mesh')} />);

    expect(glbViewerProps.current.modal).toBe(true);
  });
});
