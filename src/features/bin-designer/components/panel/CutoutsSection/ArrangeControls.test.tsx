import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/i18n';
import { ArrangeControls } from './ArrangeControls';

function renderControls(selectedIds: readonly string[]) {
  const onReorder = vi.fn();
  render(
    <LocaleProvider initialLocale="en">
      <ArrangeControls selectedIds={selectedIds} onReorder={onReorder} />
    </LocaleProvider>
  );
  return { onReorder };
}

describe('ArrangeControls', () => {
  const cases: ReadonlyArray<[string, 'front' | 'forward' | 'backward' | 'back']> = [
    ['Bring to Front', 'front'],
    ['Bring Forward', 'forward'],
    ['Send Backward', 'backward'],
    ['Send to Back', 'back'],
  ];

  for (const [label, direction] of cases) {
    it(`forwards ${direction} when "${label}" is clicked`, async () => {
      const { onReorder } = renderControls(['a', 'b']);
      await userEvent.click(screen.getByRole('button', { name: label }));
      expect(onReorder).toHaveBeenCalledWith(['a', 'b'], direction);
    });
  }

  it('disables every button when nothing is selected', () => {
    renderControls([]);
    for (const [label] of cases) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
  });
});
