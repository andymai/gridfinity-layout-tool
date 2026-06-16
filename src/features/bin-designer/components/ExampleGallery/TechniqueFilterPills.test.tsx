// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { TechniqueFilterPills } from './TechniqueFilterPills';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const examples = [
  { techniques: ['scoop'] },
  { techniques: ['slotted'] },
] as unknown as ExampleDesign[];

describe('TechniqueFilterPills', () => {
  it('renders an "All" tab plus one tab per distinct technique', () => {
    render(<TechniqueFilterPills examples={examples} selected={null} onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'binExamples.all' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'binExamples.technique.scoop' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'binExamples.technique.slotted' })).toBeInTheDocument();
  });

  it('marks the selected technique tab as selected', () => {
    render(<TechniqueFilterPills examples={examples} selected="scoop" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'binExamples.technique.scoop' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('fires onChange with the technique when a pill is clicked', () => {
    const onChange = vi.fn();
    render(<TechniqueFilterPills examples={examples} selected={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'binExamples.technique.slotted' }));
    expect(onChange).toHaveBeenCalledWith('slotted');
  });

  it('fires onChange with null when the "All" pill is clicked', () => {
    const onChange = vi.fn();
    render(<TechniqueFilterPills examples={examples} selected="scoop" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'binExamples.all' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
