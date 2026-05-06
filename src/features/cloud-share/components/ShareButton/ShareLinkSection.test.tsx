import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareLinkSection } from './ShareLinkSection';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const baseProps = {
  shareUrl: 'https://example.test/l/abc/test',
  urlCopied: false,
  onCopyUrl: vi.fn(),
  readOnlyPermission: false as const,
  permission: 'view' as const,
  onPermissionChange: vi.fn(),
};

describe('ShareLinkSection', () => {
  it('renders the share URL in a readonly input', () => {
    render(<ShareLinkSection {...baseProps} />);
    const input = screen.getByDisplayValue(baseProps.shareUrl);
    expect(input).toHaveAttribute('readonly');
  });

  it('shows the copy label when not yet copied', () => {
    render(<ShareLinkSection {...baseProps} />);
    expect(screen.getByText('common.copy')).toBeInTheDocument();
    expect(screen.queryByText('common.copied')).not.toBeInTheDocument();
  });

  it('shows the copied label when urlCopied is true', () => {
    render(<ShareLinkSection {...baseProps} urlCopied />);
    expect(screen.getByText('common.copied')).toBeInTheDocument();
  });

  it('calls onCopyUrl when the copy button is clicked', () => {
    const onCopyUrl = vi.fn();
    render(<ShareLinkSection {...baseProps} onCopyUrl={onCopyUrl} />);
    fireEvent.click(screen.getByText('common.copy'));
    expect(onCopyUrl).toHaveBeenCalledOnce();
  });

  it('renders the editable permission select by default', () => {
    render(<ShareLinkSection {...baseProps} />);
    expect(screen.getByRole('combobox')).toHaveValue('view');
  });

  it('calls onPermissionChange when the user picks a new permission', () => {
    const onPermissionChange = vi.fn();
    render(<ShareLinkSection {...baseProps} onPermissionChange={onPermissionChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'edit' } });
    expect(onPermissionChange).toHaveBeenCalledWith('edit');
  });

  it('renders read-only permission text instead of the select when readOnlyPermission is true', () => {
    const { container } = render(
      <ShareLinkSection {...baseProps} readOnlyPermission permission="edit" />
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    // Adjacent JSX expressions render as separate text nodes in the same
    // element, so getByText with a string fails (no element's textContent
    // equals the partial). Inspect the container instead.
    expect(container.textContent).toContain('share.anyoneWithLinkCan');
    expect(container.textContent).toContain('edit');
  });
});
