import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileCloudSharePanel } from './MobileCloudSharePanel';
import { resetAllStores } from '@/test/testUtils';
import * as cloudShareHook from '@/features/cloud-share/hooks/useCloudShare';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const baseHook = {
  status: 'idle' as const,
  result: null,
  error: null,
  existingShare: null,
  hasActiveShare: false,
  share: vi.fn().mockResolvedValue(undefined),
  updatePermission: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(false),
  copyUrl: vi.fn().mockResolvedValue(true),
  reset: vi.fn(),
};

describe('MobileCloudSharePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders the cloud share sheet', () => {
    vi.spyOn(cloudShareHook, 'useCloudShare').mockReturnValue({ ...baseHook });
    render(<MobileCloudSharePanel layoutId="layout-1" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls share with the selected permission when the share button is clicked', () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(cloudShareHook, 'useCloudShare').mockReturnValue({ ...baseHook, share });
    render(<MobileCloudSharePanel layoutId="layout-1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'share.shareToCloud' }));
    expect(share).toHaveBeenCalledWith('view');
  });

  it('changing the permission select updates the shared value', () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(cloudShareHook, 'useCloudShare').mockReturnValue({ ...baseHook, share });
    render(<MobileCloudSharePanel layoutId="layout-1" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('mobile.layouts.permission'), {
      target: { value: 'edit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'share.shareToCloud' }));
    expect(share).toHaveBeenCalledWith('edit');
  });

  it('calls onClose when the cancel button is clicked', () => {
    const onClose = vi.fn();
    vi.spyOn(cloudShareHook, 'useCloudShare').mockReturnValue({ ...baseHook });
    render(<MobileCloudSharePanel layoutId="layout-1" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
