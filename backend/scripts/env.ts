import fs from 'fs';
import path from 'path';

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env')
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
  loaded = true;
}

export function getTargetUrl(fallback = 'http://localhost:3000'): string {
  loadEnv();
  return process.env.TARGET_URL || process.argv[2] || fallback;
}

