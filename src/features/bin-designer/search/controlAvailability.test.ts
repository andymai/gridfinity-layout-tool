import { describe, it, expect } from 'vitest';
import { isDesignerControlAvailable, type ControlAvailabilityContext } from './controlAvailability';

const baseCtx: ControlAvailabilityContext = {
  style: 'standard',
  hasText: true,
  bedFitShown: true,
  viewMode: 'rail',
  slideTrayEnabled: true,
  scanAvailable: true,
  toolSetAvailable: true,
};

describe('isDesignerControlAvailable', () => {
  it('treats non-conditional controls as always available', () => {
    expect(isDesignerControlAvailable('bd-dimensions', baseCtx)).toBe(true);
    expect(
      isDesignerControlAvailable('bd-dimensions', {
        style: 'solid',
        hasText: false,
        bedFitShown: false,
        viewMode: 'scroll',
        slideTrayEnabled: false,
        scanAvailable: false,
        toolSetAvailable: false,
      })
    ).toBe(true);
  });

  it('offers Add a tool set only where its entry renders', () => {
    expect(isDesignerControlAvailable('bd-tool-set', baseCtx)).toBe(true);
    expect(isDesignerControlAvailable('bd-tool-set', { ...baseCtx, toolSetAvailable: false })).toBe(
      false
    );
  });

  it('hides label tabs unless the bin is a standard style', () => {
    expect(isDesignerControlAvailable('bd-label-tabs', { ...baseCtx, style: 'standard' })).toBe(
      true
    );
    expect(isDesignerControlAvailable('bd-label-tabs', { ...baseCtx, style: 'solid' })).toBe(false);
    expect(isDesignerControlAvailable('bd-label-tabs', { ...baseCtx, style: 'slotted' })).toBe(
      false
    );
  });

  it('hides typography until the design has text', () => {
    expect(isDesignerControlAvailable('bd-type', { ...baseCtx, hasText: true })).toBe(true);
    expect(isDesignerControlAvailable('bd-type', { ...baseCtx, hasText: false })).toBe(false);
  });

  it('hides the slide tray unless the labs flag is on', () => {
    expect(
      isDesignerControlAvailable('bd-slide-tray', { ...baseCtx, slideTrayEnabled: true })
    ).toBe(true);
    expect(
      isDesignerControlAvailable('bd-slide-tray', { ...baseCtx, slideTrayEnabled: false })
    ).toBe(false);
  });

  it('shows print-fit in the rail always but in the scroll only when it has something to say', () => {
    expect(
      isDesignerControlAvailable('bd-print-fit', {
        ...baseCtx,
        viewMode: 'rail',
        bedFitShown: false,
      })
    ).toBe(true);
    expect(
      isDesignerControlAvailable('bd-print-fit', {
        ...baseCtx,
        viewMode: 'scroll',
        bedFitShown: false,
      })
    ).toBe(false);
    expect(
      isDesignerControlAvailable('bd-print-fit', {
        ...baseCtx,
        viewMode: 'scroll',
        bedFitShown: true,
      })
    ).toBe(true);
  });
});
