// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { ExampleCard } from './ExampleCard';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const example: ExampleDesign = {
  id: 'custom-l-shape',
  nameKey: 'binExamples.customLShape.name',
  descriptionKey: 'binExamples.customLShape.description',
  techniques: ['customShape'],
  tier: 'technique',
  tags: ['custom-shape'],
  complexity: 1,
  params: DEFAULT_BIN_PARAMS,
  metrics: { width: 2, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
};

describe('ExampleCard', () => {
  it('renders the name, technique label, and thumbnail', () => {
    render(<ExampleCard example={example} onSelect={vi.fn()} index={0} />);
    expect(
      screen.getByRole('heading', { name: 'binExamples.customLShape.name' })
    ).toBeInTheDocument();
    expect(screen.getByText('binExamples.technique.customShape')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'binExamples.customLShape.name' })).toBeInTheDocument();
  });

  it('calls onSelect on click', () => {
    const onSelect = vi.fn();
    render(<ExampleCard example={example} onSelect={onSelect} index={0} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(example);
  });

  it('calls onSelect on Enter and Space but not other keys', () => {
    const onSelect = vi.fn();
    render(<ExampleCard example={example} onSelect={onSelect} index={0} />);
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'a' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('forwards tabIndex for roving focus', () => {
    render(<ExampleCard example={example} onSelect={vi.fn()} index={0} tabIndex={-1} />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1');
  });
});
