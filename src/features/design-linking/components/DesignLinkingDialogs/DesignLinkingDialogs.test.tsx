import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DesignLinkingDialogs } from './DesignLinkingDialogs';

// Mock child dialog components
vi.mock('../Dialogs/CreateDesignDialog', () => ({
  CreateDesignDialog: () => <div data-testid="create-design-dialog">CreateDesignDialog</div>,
}));

vi.mock('../Dialogs/SyncDimensionsDialog', () => ({
  SyncDimensionsDialog: () => <div data-testid="sync-dimensions-dialog">SyncDimensionsDialog</div>,
}));

vi.mock('../Dialogs/DeleteDesignWarningDialog', () => ({
  DeleteDesignWarningDialog: () => (
    <div data-testid="delete-design-warning-dialog">DeleteDesignWarningDialog</div>
  ),
}));

vi.mock('../Dialogs/LinkDesignDialog', () => ({
  LinkDesignDialog: () => <div data-testid="link-design-dialog">LinkDesignDialog</div>,
}));

describe('DesignLinkingDialogs', () => {
  it('renders all dialog components', () => {
    const { getByTestId } = render(<DesignLinkingDialogs />);

    expect(getByTestId('create-design-dialog')).toBeInTheDocument();
    expect(getByTestId('sync-dimensions-dialog')).toBeInTheDocument();
    expect(getByTestId('delete-design-warning-dialog')).toBeInTheDocument();
    expect(getByTestId('link-design-dialog')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<DesignLinkingDialogs />);
    expect(container).toBeDefined();
  });
});
