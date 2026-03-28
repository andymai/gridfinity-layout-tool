import { describe, it, expect, beforeEach } from 'vitest';
import { useMobileStore, INITIAL_MOBILE_STATE } from './mobile';

describe('mobileStore', () => {
  beforeEach(() => {
    useMobileStore.setState(INITIAL_MOBILE_STATE);
  });

  it('starts with null active panel', () => {
    expect(useMobileStore.getState().activeMobilePanel).toBeNull();
  });

  it('starts with layers tab', () => {
    expect(useMobileStore.getState().mobileLayersTab).toBe('layers');
  });

  describe('setActiveMobilePanel', () => {
    it('sets the active panel', () => {
      useMobileStore.getState().setActiveMobilePanel('layers');
      expect(useMobileStore.getState().activeMobilePanel).toBe('layers');
    });

    it('can set to inspector', () => {
      useMobileStore.getState().setActiveMobilePanel('inspector');
      expect(useMobileStore.getState().activeMobilePanel).toBe('inspector');
    });
  });

  describe('closeMobilePanel', () => {
    it('sets active panel to null', () => {
      useMobileStore.getState().setActiveMobilePanel('layers');
      useMobileStore.getState().closeMobilePanel();
      expect(useMobileStore.getState().activeMobilePanel).toBeNull();
    });
  });

  describe('toggleMobilePanel', () => {
    it('opens panel when none is active', () => {
      useMobileStore.getState().toggleMobilePanel('categories');
      expect(useMobileStore.getState().activeMobilePanel).toBe('categories');
    });

    it('closes panel when same panel is active', () => {
      useMobileStore.getState().setActiveMobilePanel('categories');
      useMobileStore.getState().toggleMobilePanel('categories');
      expect(useMobileStore.getState().activeMobilePanel).toBeNull();
    });

    it('switches panel when different panel is active', () => {
      useMobileStore.getState().setActiveMobilePanel('layers');
      useMobileStore.getState().toggleMobilePanel('print');
      expect(useMobileStore.getState().activeMobilePanel).toBe('print');
    });
  });

  describe('setMobileLayersTab', () => {
    it('sets to tools tab', () => {
      useMobileStore.getState().setMobileLayersTab('tools');
      expect(useMobileStore.getState().mobileLayersTab).toBe('tools');
    });

    it('sets back to layers tab', () => {
      useMobileStore.getState().setMobileLayersTab('tools');
      useMobileStore.getState().setMobileLayersTab('layers');
      expect(useMobileStore.getState().mobileLayersTab).toBe('layers');
    });
  });
});
