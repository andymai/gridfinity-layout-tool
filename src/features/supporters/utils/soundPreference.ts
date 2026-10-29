const KEY = 'gridfinity-supporters-sound';

/** Off unless this browser turned it on: sound only ever starts from a click. */
export function readSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function saveSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Blocked storage: the choice lasts for this visit only.
  }
}
