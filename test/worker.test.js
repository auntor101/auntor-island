import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleEvent } from '../worker/index.js';

const post = (body, method = 'POST') => new Request('https://x.test/api/event', { method, body: method === 'POST' ? body : undefined });

test('valid event is counted and answers 204', async () => {
  const seen = []; const env = { EVENTS: { writeDataPoint: (d) => seen.push(d) } };
  const r = await handleEvent(post('{"e":"play"}'), env);
  assert.equal(r.status, 204); assert.deepEqual(seen, [{ blobs: ['play'], doubles: [1], indexes: ['play'] }]);
});

test('bad method, bad json, unknown event and big bodies are refused', async () => {
  const env = { EVENTS: { writeDataPoint() { throw new Error('must not be called'); } } };
  assert.equal((await handleEvent(post('', 'GET'), env)).status, 405);
  assert.equal((await handleEvent(post('{nope'), env)).status, 400);
  assert.equal((await handleEvent(post('{"e":"<script>"}'), env)).status, 400);
  assert.equal((await handleEvent(post('{"e":"play","pad":"' + 'x'.repeat(300) + '"}'), env)).status, 413);
});

test('a missing or failing binding does not break the reply', async () => {
  assert.equal((await handleEvent(post('{"e":"visit"}'), {})).status, 204);
  assert.equal((await handleEvent(post('{"e":"visit"}'), { EVENTS: { writeDataPoint() { throw new Error('x'); } } })).status, 204);
});

test('other paths go to the static assets', async () => {
  const r = await worker.fetch(new Request('https://x.test/index.html'), { ASSETS: { fetch: () => new Response('page') } });
  assert.equal(await r.text(), 'page');
});
