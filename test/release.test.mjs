import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('packaged release selects standalone pad and serves its required assets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hypeliysium-release-'));
  const port = '3218';
  const child = spawn(process.execPath, ['start.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: port, PAD_DATA_DIR: dir, PURRLYSIUM_SOLANA_DATA_DIR: join(dir, 'solana') },
    stdio: 'ignore'
  });
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        const response = await fetch(`http://localhost:${port}/healthz`);
        if (response.ok) { assert.equal((await response.json()).ui, 'standalone'); ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'release must start with all required files and standalone health check');
    const html = await (await fetch(`http://localhost:${port}/`)).text();
    assert.match(html, /data-standalone="angel"/);
    assert.doesNotMatch(html, /olympus-wide|purr-portal|purrlysium\/gates.js/);
    for (const path of ['/hypurrheaven/heaven.css', '/hypurrheaven/preferences.js', '/purrlysium/identity.css', '/purrlysium/mark.svg', '/purrlysium/app.js']) {
      assert.equal((await fetch(`http://localhost:${port}${path}`)).status, 200, path);
    }
  } finally {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
