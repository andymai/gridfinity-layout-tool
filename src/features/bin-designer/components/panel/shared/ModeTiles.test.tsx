import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeTiles, type ModeTileOption } from './ModeTiles';

type Mode = 'standard' | 'spacer' | 'tray';

const OPTIONS: ModeTileOption<Mode>[] = [
  { value: 'standard', icon: null, label: 'Standard', caption: 'Feet, floor and walls' },
  {
    value: 'spacer',
    icon: null,
    label: 'Spacer',
    caption: 'An open riser',
    disabledReason: 'Blocked',
  },
  { value: 'tray', icon: null, label: 'Tray', caption: 'Sits on another bin' },
];

function renderTiles(value: Mode = 'standard') {
  const onChange = vi.fn();
  render(
    <ModeTiles ariaLabel="Body type" value={value} onChange={onChange} options={OPTIONS}>
      <div>Chosen controls</div>
    </ModeTiles>
  );
  return { onChange };
}

describe('ModeTiles', () => {
  it('captions only the chosen mode, and shows its controls', () => {
    renderTiles('tray');
    expect(screen.getByRole('radio', { name: 'Tray' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Sits on another bin')).toBeInTheDocument();
    expect(screen.queryByText('Feet, floor and walls')).toBeNull();
    expect(screen.getByText('Chosen controls')).toBeInTheDocument();
  });

  it('keeps a blocked mode out of reach and says why', () => {
    const { onChange } = renderTiles();
    const spacer = screen.getByRole('radio', { name: 'Spacer' });
    expect((spacer as HTMLButtonElement).disabled).toBe(true);
    expect(spacer.getAttribute('title')).toBe('Blocked');
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('tray');
  });

  it('chooses a mode on click', () => {
    const { onChange } = renderTiles();
    fireEvent.click(screen.getByRole('radio', { name: 'Tray' }));
    expect(onChange).toHaveBeenCalledWith('tray');
  });
});
