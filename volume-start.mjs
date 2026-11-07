import { mkdir, chown } from 'node:fs/promises';
// Railway mounts new persistent volumes as root. Prepare only this service's data
// directories, then drop privileges before loading application code.
if (process.platform !== 'win32' && process.getuid?.() === 0) {
  for (const dir of ['/app/data', '/app/data/hypeliysium']) {
    await mkdir(dir, { recursive: true });
    await chown(dir, 1000, 1000);
  }
  process.setgid(1000);
  process.setuid(1000);
}
await import('./start.mjs');
