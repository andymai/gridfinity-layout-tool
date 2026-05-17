import { readFileSync } from 'node:fs';

const ENV_FILES = ['.env.production.local', '.env.local'];

export function loadEnv(): void {
  for (const file of ENV_FILES) {
    try {
      const body = readFileSync(file, 'utf8');
      for (const line of body.split('\n')) {
        const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch {}
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    console.error(`Run \`vercel env pull .env.production.local\` to refresh credentials.`);
    process.exit(2);
  }
  return v;
}
