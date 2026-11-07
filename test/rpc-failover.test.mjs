import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Exercise the deployed bundle's exact forwarding implementation.
const runtime = await readFile(new URL('../runtime.mjs', import.meta.url), 'utf8');
const start = runtime.indexOf('  const MAX_LAG = 150n;');
const end = runtime.indexOf('  const rates =', start);
const code = `${runtime.slice(start, end)}; forward`;
for (const failure of [429, 500, -32005, 'server busy']) {
  test(`read-only RPC fails over on ${failure}`, async () => {
    const calls = [];
    const forward = runInNewContext(code, { health: new Map(), AbortSignal, fetcher: async (url, request) => {
      const { method } = JSON.parse(request.body);
      calls.push([url, method]);
      if (method === 'eth_blockNumber') return new Response(JSON.stringify({ result: '0x100' }));
      if (url === 'primary') {
        if (failure > 0) return new Response('Unavailable', { status: failure });
        return new Response(JSON.stringify({ error: { code: failure === -32005 ? failure : -32000, message: String(failure) } }));
      }
      return new Response(JSON.stringify({ result: '0x1863d' }));
    }});
    assert.equal((await forward(['primary', 'secondary'], { method: 'eth_chainId', params: [] })).result, '0x1863d');
    assert.ok(calls.some(([url, method]) => url === 'secondary' && method === 'eth_chainId'));
  });
}
test('contract reverts remain errors, not failover successes', async () => {
  let count = 0;
  const forward = runInNewContext(code, { health: new Map(), AbortSignal, fetcher: async () => {
    count++;
    return new Response(JSON.stringify({ error: { code: 3, message: 'execution reverted', data: '0x1234' } }));
  }});
  const result = await forward(['primary'], { method: 'eth_call', params: [] });
  assert.equal(result.error.data, '0x1234');
  assert.equal(count, 1);
});
