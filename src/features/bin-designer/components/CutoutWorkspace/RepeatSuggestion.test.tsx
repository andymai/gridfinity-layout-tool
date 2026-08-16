import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RepeatSuggestion } from './RepeatSuggestion';
import type { RepeatSuggestion as Suggestion } from '@/features/bin-designer/hooks/useRepeatSuggestion';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    detection: {
      mode: 'grid',
      config: {
        mode: 'grid',
        cols: 3,
        rows: 2,
        pitchX: 20,
        pitchY: 24,
        count: 6,
        radius: 30,
        startAngle: 0,
        rotateToCenter: false,
      },
      masterId: 'a',
      absorbedIds: ['b', 'c', 'd', 'e', 'f'],
      maxDriftMm: 0.4,
      colorConflict: false,
    },
    message: 'These 6 shapes can become one repeat.',
    apply: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  };
}

describe.each([
  ['panel', 'panel' as const, 'repeat-suggestion'],
  ['chip', 'chip' as const, 'repeat-suggestion-chip'],
])('%s placement', (_name, placement, testId) => {
  const Component = (props: { suggestion: Suggestion; disabled?: boolean }) => (
    <RepeatSuggestion {...props} placement={placement} />
  );
  it('states what the merge will do', () => {
    render(<Component suggestion={suggestion()} />);

    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.getByText('These 6 shapes can become one repeat.')).toBeInTheDocument();
  });

  it('applies on the action', () => {
    const apply = vi.fn();
    render(<Component suggestion={suggestion({ apply })} />);

    fireEvent.click(screen.getByText('binDesigner.cutouts.repeat.merge'));

    expect(apply).toHaveBeenCalledOnce();
  });

  it('dismisses without applying', () => {
    const apply = vi.fn();
    const dismiss = vi.fn();
    render(<Component suggestion={suggestion({ apply, dismiss })} />);

    fireEvent.click(screen.getByLabelText('common.dismiss'));

    expect(dismiss).toHaveBeenCalledOnce();
    expect(apply).not.toHaveBeenCalled();
  });

  it('blocks the action while an interaction is in flight', () => {
    const apply = vi.fn();
    render(<Component suggestion={suggestion({ apply })} disabled />);

    fireEvent.click(screen.getByText('binDesigner.cutouts.repeat.merge'));

    expect(apply).not.toHaveBeenCalled();
  });

  it('announces itself without stealing focus', () => {
    render(<Component suggestion={suggestion()} />);

    expect(screen.getByTestId(testId)).toHaveAttribute('role', 'status');
  });
});
