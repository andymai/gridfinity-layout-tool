import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { FingerAccessControls } from './FingerAccessControls';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function cut(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c',
    shape: 'slot',
    x: 40,
    y: 20,
    width: 20,
    depth: 40,
    cutDepth: 9,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

const option = (name: string) =>
  screen.getByRole('button', { name: `binDesigner.cutouts.finger.${name}` });

describe('FingerAccessControls on a slot or round', () => {
  it('turns a plain slot into a curved finger cut', () => {
    const onUpdate = vi.fn();
    render(<FingerAccessControls cutout={cut()} onUpdate={onUpdate} />);
    const toggle = screen.getByRole('switch', { name: 'binDesigner.cutouts.finger.name' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('group')).toBeNull();
    fireEvent.click(toggle);
    expect(onUpdate).toHaveBeenCalledWith({ finger: { bottom: 'curved' } });
  });

  it('switches a finger cut off', () => {
    const onUpdate = vi.fn();
    render(
      <FingerAccessControls cutout={cut({ finger: { bottom: 'curved' } })} onUpdate={onUpdate} />
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onUpdate).toHaveBeenCalledWith({ finger: undefined });
  });

  it('changes the floor and the form, and ignores a repeat pick', () => {
    const onUpdate = vi.fn();
    render(
      <FingerAccessControls cutout={cut({ finger: { bottom: 'curved' } })} onUpdate={onUpdate} />
    );
    expect(option('bottom.curved')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(option('bottom.curved'));
    fireEvent.click(option('form.slot'));
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(option('bottom.flat'));
    expect(onUpdate).toHaveBeenLastCalledWith({ finger: { bottom: 'flat' } });
    fireEvent.click(option('form.circle'));
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ shape: 'circle', width: 20, depth: 20 })
    );
  });
});

describe('FingerAccessControls on another pocket', () => {
  const rect = (overrides: Partial<Cutout> = {}) =>
    cut({ shape: 'rectangle', width: 60, depth: 20, ...overrides });

  it('offers to add finger access beside it', () => {
    const onAdd = vi.fn();
    render(<FingerAccessControls cutout={rect()} onUpdate={vi.fn()} onAdd={onAdd} />);
    expect(screen.getByText('binDesigner.cutouts.finger.addHint')).toBeInTheDocument();
    fireEvent.click(option('add'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('explains why a repeat cannot take one', () => {
    const array = {
      mode: 'grid' as const,
      cols: 2,
      rows: 1,
      pitchX: 70,
      pitchY: 0,
      count: 2,
      radius: 0,
      startAngle: 0,
      rotateToCenter: false,
    };
    render(<FingerAccessControls cutout={rect({ array })} onUpdate={vi.fn()} onAdd={vi.fn()} />);
    expect(option('add')).toBeDisabled();
    expect(screen.getByText('binDesigner.cutouts.finger.repeatBlocked')).toBeInTheDocument();
  });

  it('shows nothing where it does not apply', () => {
    const { container, rerender } = render(
      <FingerAccessControls cutout={rect({ shape: 'text' })} onUpdate={vi.fn()} onAdd={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<FingerAccessControls cutout={rect()} onUpdate={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
