// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { ALL_TECHNIQUES } from './galleryFilterOptions';
import { CommunityTechniquePills } from './CommunityTechniquePills';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('CommunityTechniquePills', () => {
  it('renders the full static technique enum plus an All pill', () => {
    render(<CommunityTechniquePills selected={null} onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(Object.keys(TECHNIQUE_CONFIG).length + 1);
    expect(radios[0]).toHaveTextContent('community.gallery.techniqueAll');
    for (const technique of ALL_TECHNIQUES) {
      expect(screen.getByText(TECHNIQUE_CONFIG[technique].labelKey)).toBeInTheDocument();
    }
  });

  it('marks the selected pill checked with roving tabindex', () => {
    render(<CommunityTechniquePills selected={ALL_TECHNIQUES[1]} onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[2]).toHaveAttribute('aria-checked', 'true');
    expect(radios[2]).toHaveAttribute('tabindex', '0');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[0]).toHaveAttribute('tabindex', '-1');
  });

  it('selects on click and toggles back to All on reselect', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CommunityTechniquePills selected={null} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect(onChange).toHaveBeenCalledWith(ALL_TECHNIQUES[0]);
    onChange.mockClear();
    rerender(<CommunityTechniquePills selected={ALL_TECHNIQUES[0]} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('moves the selection with arrow keys, wrapping at the ends', () => {
    const onChange = vi.fn();
    render(<CommunityTechniquePills selected={null} onChange={onChange} />);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(ALL_TECHNIQUES[0]);
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(ALL_TECHNIQUES[ALL_TECHNIQUES.length - 1]);
    fireEvent.keyDown(group, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(ALL_TECHNIQUES[ALL_TECHNIQUES.length - 1]);
    fireEvent.keyDown(group, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
