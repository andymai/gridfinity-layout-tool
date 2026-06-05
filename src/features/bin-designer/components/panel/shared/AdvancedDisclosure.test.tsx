import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdvancedDisclosure } from './AdvancedDisclosure';

describe('AdvancedDisclosure', () => {
  it('hides children until expanded', () => {
    render(
      <AdvancedDisclosure label="Position">
        <div>secret</div>
      </AdvancedDisclosure>
    );
    expect(screen.queryByText('secret')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Position/ }));
    expect(screen.getByText('secret')).toBeDefined();
  });

  it('stays open when forceOpen is set', () => {
    render(
      <AdvancedDisclosure label="Position" forceOpen summary="Left +2mm">
        <div>secret</div>
      </AdvancedDisclosure>
    );
    expect(screen.getByText('secret')).toBeDefined();
    expect(screen.getByText('Left +2mm')).toBeDefined();
  });
});
