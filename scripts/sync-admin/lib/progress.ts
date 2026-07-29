export interface Progress {
  phase(label: string): void;
  update(detail: string): void;
  done(detail?: string): void;
}

const NOOP: Progress = {
  phase: () => {},
  update: () => {},
  done: () => {},
};

/**
 * Phase lines on stderr so `--json` stdout stays pipeable. Interactive runs get
 * a rewriting counter; redirected ones only get the phase and its summary, or a
 * log file fills with thousands of carriage-returned partials.
 */
export function createProgress(enabled: boolean, tty = process.stderr.isTTY): Progress {
  if (!enabled) return NOOP;
  let label = '';
  let started = 0;
  const write = (s: string): void => {
    process.stderr.write(s);
  };
  return {
    phase(next: string): void {
      label = next;
      started = Date.now();
      if (tty) write(`  ${label}…`);
    },
    update(detail: string): void {
      if (tty) write(`\r  ${label}… ${detail}`);
    },
    done(detail?: string): void {
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      write(`${tty ? '\r' : ''}  ${label}… ${detail ?? 'done'} (${secs}s)\n`);
    },
  };
}
