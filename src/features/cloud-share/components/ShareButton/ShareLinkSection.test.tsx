import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareLinkSection } from './ShareLinkSection';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

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

  it('renders the read-only view permission as one translated sentence', () => {
    render(<ShareLinkSection {...baseProps} readOnlyPermission permission="view" />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('share.anyoneWithLinkCanView')).toBeInTheDocument();
  });

  it('renders the read-only edit permission as one translated sentence', () => {
    render(<ShareLinkSection {...baseProps} readOnlyPermission permission="edit" />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('share.anyoneWithLinkCanEdit')).toBeInTheDocument();
  });
});
