import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PermissionSelect,
  ShareOptionButton,
  SwipeActionButton,
  ActiveLayoutActions,
  ICON_PATHS,
} from './MobileLayoutsPanelParts';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

beforeEach(() => {
  resetAllStores();
});

describe('PermissionSelect', () => {
  it('renders both permission options', () => {
    render(<PermissionSelect value="view" onChange={vi.fn()} ariaLabel="Permission" />);
    const select = screen.getByLabelText('Permission');
    expect(select).toHaveValue('view');
    expect(
      screen.getByRole('option', { name: 'mobile.layouts.anyoneCanView' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'mobile.layouts.anyoneCanEdit' })
    ).toBeInTheDocument();
  });

  it('fires onChange with the new permission', () => {
    const onChange = vi.fn();
    render(<PermissionSelect value="view" onChange={onChange} ariaLabel="Permission" />);
    fireEvent.change(screen.getByLabelText('Permission'), { target: { value: 'edit' } });
    expect(onChange).toHaveBeenCalledWith('edit');
  });
});

describe('ShareOptionButton', () => {
  it('fires onClick when activated', () => {
    const onClick = vi.fn();
    render(
      <ShareOptionButton
        onClick={onClick}
        iconPath={ICON_PATHS.share}
        iconColor="text-accent"
        bgColor="bg-surface"
        title="Share link"
        description="Copy a link"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Share link/ }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('SwipeActionButton', () => {
  it('exposes its label and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <SwipeActionButton
        onClick={onClick}
        iconPath={ICON_PATHS.delete}
        bgColor="bg-danger"
        label="Delete layout"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete layout' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is set', () => {
    const onClick = vi.fn();
    render(
      <SwipeActionButton
        onClick={onClick}
        iconPath={ICON_PATHS.delete}
        bgColor="bg-danger"
        label="Delete layout"
        disabled
      />
    );
    expect(screen.getByRole('button', { name: 'Delete layout' })).toBeDisabled();
  });
});

describe('ActiveLayoutActions', () => {
  it('fires the matching handler with the entry id', () => {
    const onRename = vi.fn();
    render(
      <ActiveLayoutActions
        entryId="entry-9"
        onRename={onRename}
        onShare={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.rename' }));
    expect(onRename).toHaveBeenCalledWith('entry-9');
  });
});
