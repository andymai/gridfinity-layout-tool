import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { DrawerShapeEditButton } from '@/features/drawer-shape';
import { BaseplateRoute } from './BaseplateRoute';

const received = vi.hoisted((): { shapeEditor?: ComponentType } => ({}));

vi.mock('@/features/baseplate', () => ({
  BaseplatePage: ({ shapeEditor }: { shapeEditor?: ComponentType }) => {
    received.shapeEditor = shapeEditor;
    return <div data-testid="baseplate-page" />;
  },
}));

describe('BaseplateRoute', () => {
  it('hands the baseplate page the drawer-shape editor', () => {
    render(<BaseplateRoute />);
    expect(screen.getByTestId('baseplate-page')).toBeInTheDocument();
    expect(received.shapeEditor).toBe(DrawerShapeEditButton);
  });
});
