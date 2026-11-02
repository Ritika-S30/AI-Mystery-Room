import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { InvestigationError } from '../src/services/investigations.js';

const guestId = '456e6d66-eab2-4e27-8c42-3435812e7a17';

async function withServer(t, app) {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return `http://127.0.0.1:${server.address().port}/api/investigations`;
}

test('investigation routes validate guest ownership and expose saved workspace fields', async (t) => {
  const calls = [];
  const app = createApp({ investigationService: {
    create: async (input) => { calls.push(['create', input]); return { investigation: { id: 'i1' }, guestId }; },
    list: async (input) => { calls.push(['list', input]); return []; },
    workspace: async (input) => {
      calls.push(['workspace', input]);
      if (!input.guestId) throw new InvestigationError('A valid guest session is required.', 401);
      return { investigation: { status: 'active' }, mystery: { title: 'Public case' }, suspects: [], evidence: [] };
    },
    note: async (input) => { calls.push(['note', input]); return { notes: [{ text: input.text }] }; },
    review: async (input) => { calls.push(['review', input]); return { reviewedEvidence: [input.evidenceId] }; },
    hint: async (input) => { calls.push(['hint', input]); return { hint: 'Compare the two times.', hintsUsed: 1 }; },
    accuse: async (input) => { calls.push(['accuse', input]); return { investigation: { status: 'completed' }, solution: { culprit: { name: 'Private reveal' } } }; },
    solution: async (input) => { calls.push(['solution', input]); throw new InvestigationError('Make an accusation before the solution can be revealed.', 403); },
  } });
  const base = await withServer(t, app);

  const create = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', 'x-guest-id': guestId }, body: JSON.stringify({ mysteryId: 'case1' }) });
  assert.equal(create.status, 200);
  const missingOwner = await fetch(`${base}/i1`);
  assert.equal(missingOwner.status, 401);
  const workspace = await fetch(`${base}/i1`, { headers: { 'x-guest-id': guestId } });
  assert.equal(workspace.status, 200);
  assert.equal((await workspace.json()).mystery.title, 'Public case');
  assert.deepEqual(calls.slice(0, 3).map(([name]) => name), ['create', 'workspace', 'workspace']);
  assert.equal(calls[0][1].guestId, guestId);
  assert.equal(calls[0][1].mysteryId, 'case1');
});

test('solution route returns forbidden until the service permits reveal', async (t) => {
  const app = createApp({ investigationService: {
    create: async () => ({}), list: async () => [], workspace: async () => ({}), note: async () => ({}),
    review: async () => ({}), hint: async () => ({}), accuse: async () => ({}),
    solution: async () => { throw new InvestigationError('Make an accusation before the solution can be revealed.', 403); },
  } });
  const base = await withServer(t, app);
  const response = await fetch(`${base}/i1/solution`, { headers: { 'x-guest-id': guestId } });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Make an accusation before the solution can be revealed.' });
});
