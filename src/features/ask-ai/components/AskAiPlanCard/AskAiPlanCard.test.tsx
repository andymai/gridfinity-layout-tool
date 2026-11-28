import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlanView } from '@/agent/contract';
import { AskAiPlanCard } from './AskAiPlanCard';

const plan: PlanView = {
  handle: '0a1b2c3d',
  title: 'Workbench',
  grid: { width: 6, depth: 4 },
  bins: [{ label: 'Pliers', x: 0, y: 0, width: 3, depth: 2, layer: 1, color: '#3b82f6' }],
  stashed: [{ label: 'Saw', reason: 'too long' }],
  link: 'https://gridfinitylayouttool.com/#plan=v1.abc',
};

describe('AskAiPlanCard', () => {
  it('captions the plan and opens it in the editor', () => {
    const onOpen = vi.fn();
    render(<AskAiPlanCard plan={plan} onOpen={onOpen} />);
    expect(screen.getByText('6 × 4 units · 1 bin · 1 in the stash')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open in the editor' }));
    expect(onOpen).toHaveBeenCalledWith(plan);
  });
});
