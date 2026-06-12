import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, type TabItem } from '.';

type TabId = 'general' | 'display' | 'advanced';

const tabs: TabItem<TabId>[] = [
  { id: 'general', label: 'General' },
  { id: 'display', label: 'Display' },
  { id: 'advanced', label: 'Advanced' },
];

const defaultProps = {
  tabs,
  activeTab: 'general' as TabId,
  onChange: vi.fn(),
  'aria-label': 'Settings sections',
};

describe('Tabs', () => {
  describe('rendering', () => {
    it('renders a tablist with the given accessible name', () => {
      render(<Tabs.List {...defaultProps} />);
      expect(screen.getByRole('tablist', { name: 'Settings sections' })).toBeInTheDocument();
    });

    it('renders one tab per item with aria-selected on the active tab', () => {
      render(<Tabs.List {...defaultProps} activeTab="display" />);
      expect(screen.getAllByRole('tab')).toHaveLength(3);
      expect(screen.getByRole('tab', { name: 'Display' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });

    it('sets aria-orientation horizontal by default', () => {
      render(<Tabs.List {...defaultProps} />);
      expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('sets aria-orientation vertical for vertical lists', () => {
      render(<Tabs.List {...defaultProps} orientation="vertical" />);
      expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('names icon-only tabs via aria-label', () => {
      const iconTabs: TabItem<'help'>[] = [
        { id: 'help', label: <svg aria-hidden="true" />, 'aria-label': 'Help' },
      ];
      render(<Tabs.List tabs={iconTabs} activeTab="help" onChange={vi.fn()} aria-label="Topics" />);
      expect(screen.getByRole('tab', { name: 'Help' })).toBeInTheDocument();
    });

    it('renders trailing badge content', () => {
      const badgeTabs: TabItem<TabId>[] = [{ id: 'general', label: 'General', badge: 12 }];
      render(<Tabs.List {...defaultProps} tabs={badgeTabs} />);
      expect(screen.getByRole('tab', { name: /General/ })).toHaveTextContent('12');
    });

    it('disables tabs marked disabled', () => {
      const withDisabled: TabItem<TabId>[] = [
        { id: 'general', label: 'General' },
        { id: 'display', label: 'Display', disabled: true },
      ];
      render(<Tabs.List {...defaultProps} tabs={withDisabled} />);
      expect(screen.getByRole('tab', { name: 'Display' })).toBeDisabled();
    });

    it('applies className to the tablist', () => {
      render(<Tabs.List {...defaultProps} className="custom-class" />);
      expect(screen.getByRole('tablist')).toHaveClass('custom-class');
    });
  });

  describe('id wiring', () => {
    it('wires aria-controls and aria-labelledby between tab and panel', () => {
      render(
        <Tabs.Root>
          <Tabs.List {...defaultProps} />
          <Tabs.Panel tabId="general" activeTab="general">
            Content
          </Tabs.Panel>
        </Tabs.Root>
      );
      const tab = screen.getByRole('tab', { name: 'General' });
      const panel = screen.getByRole('tabpanel');
      expect(tab).toHaveAttribute('aria-controls', panel.id);
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    });

    it('omits aria-controls when used without Tabs.Root', () => {
      render(<Tabs.List {...defaultProps} />);
      expect(screen.getByRole('tab', { name: 'General' })).not.toHaveAttribute('aria-controls');
    });
  });

  describe('interactions', () => {
    it('calls onChange with the tab id on click', () => {
      const onChange = vi.fn();
      render(<Tabs.List {...defaultProps} onChange={onChange} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }));
      expect(onChange).toHaveBeenCalledWith('advanced');
    });

    it('does not call onChange when clicking a disabled tab', () => {
      const onChange = vi.fn();
      const withDisabled: TabItem<TabId>[] = [
        { id: 'general', label: 'General' },
        { id: 'display', label: 'Display', disabled: true },
      ];
      render(<Tabs.List {...defaultProps} tabs={withDisabled} onChange={onChange} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Display' }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('moves to the next tab with ArrowRight when horizontal', () => {
      const onChange = vi.fn();
      render(<Tabs.List {...defaultProps} onChange={onChange} />);
      fireEvent.keyDown(screen.getByRole('tab', { name: 'General' }), { key: 'ArrowRight' });
      expect(onChange).toHaveBeenCalledWith('display');
      expect(screen.getByRole('tab', { name: 'Display' })).toHaveFocus();
    });

    it('wraps to the last tab with ArrowLeft from the first', () => {
      const onChange = vi.fn();
      render(<Tabs.List {...defaultProps} onChange={onChange} />);
      fireEvent.keyDown(screen.getByRole('tab', { name: 'General' }), { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenCalledWith('advanced');
    });

    it('jumps to first and last enabled tabs with Home and End', () => {
      const onChange = vi.fn();
      render(<Tabs.List {...defaultProps} activeTab="display" onChange={onChange} />);
      const tab = screen.getByRole('tab', { name: 'Display' });
      fireEvent.keyDown(tab, { key: 'End' });
      expect(onChange).toHaveBeenCalledWith('advanced');
      fireEvent.keyDown(tab, { key: 'Home' });
      expect(onChange).toHaveBeenCalledWith('general');
    });

    it('uses ArrowDown/ArrowUp instead of ArrowRight/ArrowLeft when vertical', () => {
      const onChange = vi.fn();
      render(<Tabs.List {...defaultProps} orientation="vertical" onChange={onChange} />);
      const tab = screen.getByRole('tab', { name: 'General' });
      fireEvent.keyDown(tab, { key: 'ArrowRight' });
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.keyDown(tab, { key: 'ArrowDown' });
      expect(onChange).toHaveBeenCalledWith('display');
      fireEvent.keyDown(tab, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenCalledWith('advanced');
    });

    it('skips disabled tabs during arrow navigation', () => {
      const onChange = vi.fn();
      const withDisabled: TabItem<TabId>[] = [
        { id: 'general', label: 'General' },
        { id: 'display', label: 'Display', disabled: true },
        { id: 'advanced', label: 'Advanced' },
      ];
      render(<Tabs.List {...defaultProps} tabs={withDisabled} onChange={onChange} />);
      fireEvent.keyDown(screen.getByRole('tab', { name: 'General' }), { key: 'ArrowRight' });
      expect(onChange).toHaveBeenCalledWith('advanced');
    });

    it('applies roving tabindex with only the active tab focusable', () => {
      render(<Tabs.List {...defaultProps} activeTab="display" />);
      expect(screen.getByRole('tab', { name: 'Display' })).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('tab', { name: 'Advanced' })).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('visual variants', () => {
    it('applies underline classes to the active tab by default', () => {
      render(<Tabs.List {...defaultProps} />);
      const active = screen.getByRole('tab', { name: 'General' });
      expect(active.className).toContain('border-b-2');
      expect(active.className).toContain('border-accent');
      expect(active.className).toContain('text-accent');
    });

    it('applies rail classes to the active tab', () => {
      render(<Tabs.List {...defaultProps} orientation="vertical" visual="rail" />);
      const active = screen.getByRole('tab', { name: 'General' });
      expect(active.className).toContain('border-l-2');
      expect(active.className).toContain('bg-surface-elevated');
    });

    it('applies pill classes to the active tab', () => {
      render(<Tabs.List {...defaultProps} visual="pill" />);
      const active = screen.getByRole('tab', { name: 'General' });
      expect(active.className).toContain('rounded-full');
      expect(active.className).toContain('bg-accent');
    });

    it('applies flex-1 to tabs when fullWidth', () => {
      render(<Tabs.List {...defaultProps} visual="pill" fullWidth />);
      expect(screen.getByRole('tab', { name: 'General' }).className).toContain('flex-1');
    });
  });

  describe('panel', () => {
    it('unmounts the inactive panel by default', () => {
      render(
        <Tabs.Root>
          <Tabs.Panel tabId="display" activeTab="general">
            Display content
          </Tabs.Panel>
        </Tabs.Root>
      );
      expect(screen.queryByRole('tabpanel', { hidden: true })).not.toBeInTheDocument();
    });

    it('keeps the inactive panel mounted and hidden with keepMounted', () => {
      render(
        <Tabs.Root>
          <Tabs.Panel tabId="display" activeTab="general" keepMounted>
            Display content
          </Tabs.Panel>
        </Tabs.Root>
      );
      const panel = screen.getByRole('tabpanel', { hidden: true });
      expect(panel).toHaveAttribute('hidden');
      expect(panel).toHaveTextContent('Display content');
    });

    it('sets tabindex 0 when the panel has no focusable content', () => {
      render(
        <Tabs.Root>
          <Tabs.Panel tabId="general" activeTab="general">
            Plain text
          </Tabs.Panel>
        </Tabs.Root>
      );
      expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0');
    });

    it('omits tabindex when the panel contains focusable content', () => {
      render(
        <Tabs.Root>
          <Tabs.Panel tabId="general" activeTab="general">
            <button type="button">Action</button>
          </Tabs.Panel>
        </Tabs.Root>
      );
      expect(screen.getByRole('tabpanel')).not.toHaveAttribute('tabindex');
    });

    it('applies className to the panel', () => {
      render(
        <Tabs.Root>
          <Tabs.Panel tabId="general" activeTab="general" className="custom-class">
            Content
          </Tabs.Panel>
        </Tabs.Root>
      );
      expect(screen.getByRole('tabpanel')).toHaveClass('custom-class');
    });

    it('throws when used outside Tabs.Root', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(() =>
        render(
          <Tabs.Panel tabId="general" activeTab="general">
            Content
          </Tabs.Panel>
        )
      ).toThrow('Tabs.Panel must be used within Tabs.Root');
      consoleError.mockRestore();
    });
  });
});
