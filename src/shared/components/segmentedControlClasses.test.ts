import { describe, it, expect } from 'vitest';
import {
  getSegmentClass,
  SEGMENT_ACTIVE,
  SEGMENT_INACTIVE,
  SEGMENT_GROUP_CLASS,
} from './segmentedControlClasses';

describe('getSegmentClass', () => {
  it('renders a raised neutral pill when active', () => {
    const cls = getSegmentClass(true);
    expect(cls).toContain('bg-surface-elevated');
    expect(cls).toContain('text-content');
    expect(cls).toContain('shadow-sm');
    // The selected segment is a neutral pill, not an accent tint — that accent
    // treatment is reserved for independent on/off toggles (SEGMENT_ACTIVE).
    expect(cls).not.toContain('bg-accent/15');
  });

  it('applies the quiet inactive treatment when not active', () => {
    const cls = getSegmentClass(false);
    expect(cls).toContain('text-content-tertiary');
    expect(cls).toContain('hover:bg-surface-hover');
    expect(cls).not.toContain('bg-surface-elevated');
  });

  it('uses compact sizing for sm and default sizing for md', () => {
    expect(getSegmentClass(false, { size: 'sm' })).toContain('text-[11px]');
    expect(getSegmentClass(false, { size: 'md' })).toContain('text-xs');
    expect(getSegmentClass(false)).toContain('text-xs');
  });

  it('uses square padding for the icon size', () => {
    const cls = getSegmentClass(false, { size: 'icon' });
    expect(cls).toContain('p-1');
    expect(cls).not.toContain('px-1.5');
    expect(cls).not.toContain('px-2');
  });

  it('always includes focus-visible and disabled affordances', () => {
    const cls = getSegmentClass(false);
    expect(cls).toContain('focus-visible:ring-accent');
    expect(cls).toContain('disabled:opacity-50');
    expect(cls).toContain('disabled:cursor-not-allowed');
  });

  it('exposes accent on/off fragments for bespoke independent toggles', () => {
    expect(SEGMENT_ACTIVE).toContain('bg-accent/15');
    expect(SEGMENT_INACTIVE).toContain('text-content-tertiary');
  });

  it('renders the group container as a bordered track (matches ToolSwitcher)', () => {
    expect(SEGMENT_GROUP_CLASS).toContain('flex');
    expect(SEGMENT_GROUP_CLASS).toContain('border');
    expect(SEGMENT_GROUP_CLASS).toContain('bg-surface');
    expect(SEGMENT_GROUP_CLASS).toContain('rounded-lg');
    expect(SEGMENT_GROUP_CLASS).toContain('p-0.5');
  });
});
