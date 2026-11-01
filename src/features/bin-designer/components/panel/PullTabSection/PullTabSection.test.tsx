import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PullTabSection } from './PullTabSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import en from '@/i18n/locales/en';
import { DEFAULT_PULL_TAB, pullTabUnavailableReason } from '@/shared/utils/pullTabPlan';

describe('PullTabSection', () => {
  beforeEach(() =>
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, pullTab: { ...DEFAULT_PULL_TAB, enabled: true } },
      ui: { ...DEFAULT_UI_STATE },
    })
  );
  const wall = (name: string) => screen.getByRole('switch', { name });
  const pullTab = () => useDesignerStore.getState().params.pullTab;

  it('offers all four walls, starting on the front, and independent rounding controls', () => {
    render(<PullTabSection />);
    expect(screen.getByRole('group', { name: 'Walls with a pull tab' })).toBeDefined();
    expect(wall('Front').getAttribute('aria-checked')).toBe('true');
    for (const name of ['Back', 'Left', 'Right']) {
      expect(wall(name).getAttribute('aria-checked')).toBe('false');
    }
    expect(screen.getByText('Top corner radius')).toBeDefined();
    expect(screen.getByText('Wall transition radius')).toBeDefined();
    expect(screen.getByText('Recess outside fillet')).toBeDefined();
    expect(screen.getByText('Recess inside fillet')).toBeDefined();
  });
  it('adds and removes walls, and comes back to the front alone as it started', () => {
    const before = JSON.stringify(pullTab());
    render(<PullTabSection />);
    fireEvent.click(wall('Back'));
    expect(pullTab()).toMatchObject({ wall: 'width', walls: ['front', 'back'] });
    fireEvent.click(wall('Right'));
    expect(pullTab()?.walls).toEqual(['front', 'back', 'right']);
    fireEvent.click(wall('Back'));
    fireEvent.click(wall('Right'));
    expect(JSON.stringify(pullTab())).toBe(before);
  });
  it('writes a lone right wall as the depth wall saved designs use', () => {
    render(<PullTabSection />);
    fireEvent.click(wall('Right'));
    fireEvent.click(wall('Front'));
    expect(pullTab()?.wall).toBe('depth');
    expect(pullTab()).not.toHaveProperty('walls');
  });
  it('keeps the last wall on and pushes no undo entry for clicking it', () => {
    render(<PullTabSection />);
    const params = useDesignerStore.getState().params;
    const undoDepth = useDesignerStore.getState().history.past.length;
    fireEvent.click(wall('Front'));
    expect(useDesignerStore.getState().params).toBe(params);
    expect(useDesignerStore.getState().history.past.length).toBe(undoDepth);
    expect(wall('Front').getAttribute('aria-checked')).toBe('true');
    expect((wall('Front') as HTMLButtonElement).disabled).toBe(false);
  });
  it('reports the tab width per axis once walls of two lengths carry tabs', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 3,
        pullTab: { ...DEFAULT_PULL_TAB, enabled: true, widthMode: 'percent' },
      },
    });
    render(<PullTabSection />);
    fireEvent.click(wall('Back'));
    expect(screen.queryByText(/front\/back/)).toBeNull();
    expect(screen.getByText('Current tab width: 55.5 mm.')).toBeDefined();
    fireEvent.click(wall('Left'));
    expect(screen.getByText('Tab width: 55.5 mm front/back, 87.0 mm sides.')).toBeDefined();
    expect(
      screen.getByText(/^Recess width: \d+\.\d mm front\/back, \d+\.\d mm sides/)
    ).toBeDefined();
  });
  it('keeps the longest wall’s tab width when switching from mm to percent', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 3,
        pullTab: { ...DEFAULT_PULL_TAB, enabled: true, wall: 'width', walls: ['front', 'left'] },
      },
    });
    render(<PullTabSection />);
    fireEvent.click(screen.getByRole('button', { name: '%' }));
    expect(screen.getByText('Tab width: 31.9 mm front/back, 50.0 mm sides.')).toBeDefined();
  });
  it('keeps a tab that has run out of room switchable, so the wall that caused it can go', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 0.5,
        gridUnitMm: 16,
        wallThickness: 1.6,
        pullTab: {
          ...DEFAULT_PULL_TAB,
          enabled: true,
          thickness: 4,
          wall: 'width',
          walls: ['front', 'back'],
        },
      },
    });
    const reason =
      'The tabs leave no room inside a bin this small. Pick fewer walls or a thinner tab.';
    render(<PullTabSection />);
    expect(screen.getByText(reason)).toBeDefined();
    expect(screen.getByRole('switch', { name: 'Pull tab' }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(wall('Back'));
    expect(pullTab()).toMatchObject({ enabled: true, wall: 'width' });
    expect(pullTab()).not.toHaveProperty('walls');
    expect(screen.queryByText(reason)).toBeNull();
    expect(pullTabUnavailableReason(useDesignerStore.getState().params)).toBeUndefined();
  });
  const crowded = (pullTab: Partial<typeof DEFAULT_PULL_TAB>) =>
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 0.5,
        gridUnitMm: 16,
        wallThickness: 1.6,
        pullTab: {
          ...DEFAULT_PULL_TAB,
          thickness: 4,
          wall: 'width',
          walls: ['front', 'back'],
          ...pullTab,
        },
      },
    });
  it('lets a tab that is off with no room be turned back on and fixed', () => {
    crowded({ enabled: false });
    render(<PullTabSection />);
    const toggle = screen.getByRole('switch', { name: 'Pull tab' });
    expect(toggle.hasAttribute('disabled')).toBe(false);
    fireEvent.click(toggle);
    fireEvent.click(wall('Back'));
    expect(pullTab()).toMatchObject({ enabled: true, wall: 'width' });
    expect(pullTabUnavailableReason(useDesignerStore.getState().params)).toBeUndefined();
  });
  it('keeps the tab width across a unit switch made while it has no room', () => {
    crowded({ enabled: true, width: 20 });
    render(<PullTabSection />);
    fireEvent.click(screen.getByRole('button', { name: '%' }));
    // 20mm of the 22mm a 32mm wall leaves for a tab.
    expect(pullTab()?.widthPercent).toBeCloseTo((20 / 22) * 100, 1);
    fireEvent.click(screen.getByRole('button', { name: 'mm' }));
    expect(pullTab()?.width).toBeCloseTo(20, 1);
  });
  it('keeps the saved width when no chosen wall can carry a tab', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 0.5,
        pullTab: { ...DEFAULT_PULL_TAB, enabled: true, width: 50 },
      },
    });
    render(<PullTabSection />);
    fireEvent.click(screen.getByRole('button', { name: '%' }));
    fireEvent.click(screen.getByRole('button', { name: 'mm' }));
    expect(pullTab()).toMatchObject({ widthMode: 'mm', width: 50 });
  });
  it('says when a chosen wall is too short to carry a tab', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 0.5,
        pullTab: { ...DEFAULT_PULL_TAB, enabled: true },
      },
    });
    render(<PullTabSection />);
    expect(screen.getByText('A wall shorter than 22 mm has no room for a tab.')).toBeDefined();
    fireEvent.click(wall('Left'));
    fireEvent.click(wall('Front'));
    expect(screen.queryByText('A wall shorter than 22 mm has no room for a tab.')).toBeNull();
  });
  it('changes the common border and reports the resulting recess width', () => {
    render(<PullTabSection />);
    const input = screen.getByLabelText('Recess border width');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);
    expect(useDesignerStore.getState().params.pullTab?.recessBorder).toBe(2);
    expect(screen.getByText(/Recess width: 38.0 mm/)).toBeDefined();
  });
  it('changes the inside fillet independently of the outside fillet', () => {
    render(<PullTabSection />);
    const input = screen.getByLabelText('Recess inside fillet');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(useDesignerStore.getState().params.pullTab?.recessInsideRadius).toBe(0);
    expect(useDesignerStore.getState().params.pullTab?.recessEdgeRadius).toBe(0.4);
  });
  it('enables the optional back recess and constrains its shared depth', () => {
    render(<PullTabSection />);
    fireEvent.click(screen.getByRole('switch', { name: 'Back recess' }));
    expect(useDesignerStore.getState().params.pullTab?.backRecess).toBe(true);
    expect(screen.getByLabelText('Recess depth').getAttribute('max')).toBe('1.1');
    expect(useDesignerStore.getState().params.pullTab?.recessDepth).toBe(1);
  });
  it('accepts larger recess fillets and switches between mm and percent', () => {
    render(<PullTabSection />);
    for (const label of ['Recess outside fillet', 'Recess inside fillet']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: '2' } });
      fireEvent.blur(screen.getByLabelText(label));
      expect(screen.getByLabelText(label).getAttribute('max')).toBe('6');
    }
    expect(useDesignerStore.getState().params.pullTab).toMatchObject({
      recessEdgeRadius: 2,
      recessInsideRadius: 2,
    });
    fireEvent.click(screen.getByRole('button', { name: '%' }));
    fireEvent.change(screen.getByLabelText('Tab width'), { target: { value: '60' } });
    fireEvent.blur(screen.getByLabelText('Tab width'));
    expect(useDesignerStore.getState().params.pullTab).toMatchObject({
      widthMode: 'percent',
      widthPercent: 60,
    });
    fireEvent.click(screen.getByRole('button', { name: 'mm' }));
    expect(useDesignerStore.getState().params.pullTab).toMatchObject({
      widthMode: 'mm',
      width: 44.4,
    });
  });

  it('plays a clip of the feature from the dot beside its toggle', () => {
    render(<PullTabSection />);
    fireEvent.click(screen.getByRole('button', { name: 'See how Pull tab works' }));
    expect(screen.getByText(en['binDesigner.featureTip.pullTab'])).toBeInTheDocument();
    expect(screen.getByText(en['binDesigner.pullTab.description'])).toBeInTheDocument();
  });
});
