import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LayoutFolder } from '@/core/types';
import { FolderBreadcrumb } from './FolderBreadcrumb';

const folder = (id: string, name: string, parentId: string | null): LayoutFolder => ({
  id,
  name,
  parentId,
  createdAt: 1,
  modifiedAt: 1,
});

describe('FolderBreadcrumb', () => {
  it('shows only the root at the top level, as the current location', () => {
    render(<FolderBreadcrumb path={[]} onNavigate={() => {}} />);
    expect(screen.getByText('All layouts')).toHaveAttribute('aria-current', 'location');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('links every ancestor and leaves the current folder plain', () => {
    const onNavigate = vi.fn();
    render(
      <FolderBreadcrumb
        path={[folder('study', 'Study', null), folder('desk', 'Desk', 'study')]}
        onNavigate={onNavigate}
      />
    );
    expect(screen.getByText('Desk')).toHaveAttribute('aria-current', 'location');
    fireEvent.click(screen.getByRole('button', { name: 'Study' }));
    expect(onNavigate).toHaveBeenCalledWith('study');
    fireEvent.click(screen.getByRole('button', { name: 'All layouts' }));
    expect(onNavigate).toHaveBeenCalledWith(null);
  });
});
