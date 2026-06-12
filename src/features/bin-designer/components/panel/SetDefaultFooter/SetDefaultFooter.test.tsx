import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetDefaultFooter } from './SetDefaultFooter';
import { useBinDefaultsStore } from '@/features/bin-designer/store/binDefaults';
import { hasCustomDefault } from '@/features/bin-designer/storage/defaultParamsStorage';
import { resetAllStores } from '@/test/testUtils';

describe('SetDefaultFooter', () => {
  beforeEach(() => {
    resetAllStores();
    localStorage.clear();
    useBinDefaultsStore.setState({ hasCustomDefault: false });
  });

  it('renders the set-as-default action', () => {
    render(<SetDefaultFooter />);
    expect(screen.getByRole('button', { name: /default for new bins/i })).toBeInTheDocument();
  });

  it('hides the active hint until a custom default exists', () => {
    render(<SetDefaultFooter />);
    expect(screen.queryByText(/custom default active/i)).not.toBeInTheDocument();
  });

  it('persists the default and shows the active hint when clicked', () => {
    render(<SetDefaultFooter />);
    fireEvent.click(screen.getByRole('button', { name: /default for new bins/i }));

    expect(hasCustomDefault()).toBe(true);
    expect(screen.getByText(/custom default active/i)).toBeInTheDocument();
  });
});
