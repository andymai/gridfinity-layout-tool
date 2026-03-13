type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context !== undefined ? { context } : {}),
  };
  let output: string;
  try {
    output = JSON.stringify(entry);
  } catch {
    // Fallback if context contains non-serializable values (circular refs, BigInt, etc.)
    output = JSON.stringify({ level, message, timestamp: entry.timestamp });
  }
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    // console.log is not in the ESLint allow-list (warn/error are); disable for logger internals only
    // eslint-disable-next-line no-console
    console.log(output);
  }
}

export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
};
