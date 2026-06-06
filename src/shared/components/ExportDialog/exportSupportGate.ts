/**
 * Decides whether the export dialog should show its support ask. The gating is
 * the point: never on a user's FIRST export (they haven't printed the result
 * yet — too early to ask), from the 2nd export on, and at most once per cooldown
 * so frequent exporters are never nagged.
 *
 * Self-contained (its own localStorage key) so it stays out of the engagement
 * feature and both export paths can use it without a cross-feature import.
 */

const STORAGE_KEY = 'gridfinity-export-support-v1';
const COOLDOWN_DAYS = 30;
const MIN_EXPORTS_BEFORE_ASK = 2;

interface ExportSupportState {
  /** Lifetime count of successful exports across both tools. */
  exportCount: number;
  /** ISO timestamp the support ask was last shown. */
  lastShown?: string;
}

function load(): ExportSupportState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ExportSupportState;
  } catch {
    /* ignore malformed / unavailable storage */
  }
  return { exportCount: 0 };
}

function save(state: ExportSupportState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be full or unavailable */
  }
}

function cooledDown(lastShown: string | undefined): boolean {
  if (!lastShown) return true;
  const elapsed = Date.now() - new Date(lastShown).getTime();
  return elapsed > COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Record a successful export and return whether to show the support ask now.
 * Call exactly once per successful export. Has a side effect: increments the
 * stored export count and, when it returns true, stamps the cooldown.
 */
export function recordExportAndShouldPromptSupport(): boolean {
  const state = load();
  state.exportCount += 1;

  const show = state.exportCount >= MIN_EXPORTS_BEFORE_ASK && cooledDown(state.lastShown);
  if (show) state.lastShown = new Date().toISOString();

  save(state);
  return show;
}
