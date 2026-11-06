import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { useSpaceMouseStore } from './settingsStore';

beforeEach(() => {
  useSpaceMouseStore.setState({
    settings: DEFAULT_SETTINGS,
    status: 'idle',
    deviceName: null,
  });
});

describe('the SpaceMouse opt-in', () => {
  const LABS_KEY = 'gridfinity-labs-v1';

  function labsOptIn(on: boolean): void {
    localStorage.setItem(LABS_KEY, JSON.stringify({ enabledFeatures: { spacemouse: on } }));
  }

  beforeEach(() => {
    localStorage.clear();
    useSpaceMouseStore.setState({ enabled: false });
    localStorage.clear();
  });

  it('is off for someone who never turned it on', async () => {
    await useSpaceMouseStore.persist.rehydrate();
    expect(useSpaceMouseStore.getState().enabled).toBe(false);
  });

  it('stays on for someone who turned it on in Labs', async () => {
    labsOptIn(true);
    await useSpaceMouseStore.persist.rehydrate();
    expect(useSpaceMouseStore.getState().enabled).toBe(true);
  });

  it('stays off for someone who turned it off in Labs', async () => {
    labsOptIn(false);
    await useSpaceMouseStore.persist.rehydrate();
    expect(useSpaceMouseStore.getState().enabled).toBe(false);
  });

  it('lets turning it off here win over an old Labs opt-in', async () => {
    labsOptIn(true);
    await useSpaceMouseStore.persist.rehydrate();
    useSpaceMouseStore.getState().setEnabled(false);
    await useSpaceMouseStore.persist.rehydrate();
    expect(useSpaceMouseStore.getState().enabled).toBe(false);
  });

  it('survives resetting the tuning', () => {
    useSpaceMouseStore.getState().setEnabled(true);
    useSpaceMouseStore.getState().resetSettings();
    expect(useSpaceMouseStore.getState().enabled).toBe(true);
  });

  it('ignores a corrupt Labs preference', async () => {
    localStorage.setItem(LABS_KEY, '{not json');
    await useSpaceMouseStore.persist.rehydrate();
    expect(useSpaceMouseStore.getState().enabled).toBe(false);
  });
});

describe('useSpaceMouseStore', () => {
  it('updates sensitivity and speeds without touching other fields', () => {
    useSpaceMouseStore.getState().setSensitivity(2);
    useSpaceMouseStore.getState().setTranslateSpeed(0.5);
    useSpaceMouseStore.getState().setRotateSpeed(1.5);
    const { settings } = useSpaceMouseStore.getState();
    expect(settings.sensitivity).toBe(2);
    expect(settings.translateSpeed).toBe(0.5);
    expect(settings.rotateSpeed).toBe(1.5);
    expect(settings.invert.panX).toBe(false);
  });

  it('toggles a single invert axis', () => {
    useSpaceMouseStore.getState().toggleInvert('orbitH');
    expect(useSpaceMouseStore.getState().settings.invert.orbitH).toBe(true);
    expect(useSpaceMouseStore.getState().settings.invert.orbitV).toBe(false);
    useSpaceMouseStore.getState().toggleInvert('orbitH');
    expect(useSpaceMouseStore.getState().settings.invert.orbitH).toBe(false);
  });

  it('resets tuning to defaults', () => {
    useSpaceMouseStore.getState().setSensitivity(3);
    useSpaceMouseStore.getState().toggleInvert('zoom');
    useSpaceMouseStore.getState().resetSettings();
    expect(useSpaceMouseStore.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('tracks connection status and device name independently', () => {
    useSpaceMouseStore.getState().setConnection('connected', 'SpaceMouse Pro');
    expect(useSpaceMouseStore.getState().status).toBe('connected');
    expect(useSpaceMouseStore.getState().deviceName).toBe('SpaceMouse Pro');
    // Omitting the name keeps the previous one.
    useSpaceMouseStore.getState().setConnection('error');
    expect(useSpaceMouseStore.getState().status).toBe('error');
    expect(useSpaceMouseStore.getState().deviceName).toBe('SpaceMouse Pro');
    // Passing null clears it.
    useSpaceMouseStore.getState().setConnection('idle', null);
    expect(useSpaceMouseStore.getState().deviceName).toBeNull();
  });
});
