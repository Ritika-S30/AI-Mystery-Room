import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import Mystery from '../src/models/Mystery.js';
import { generateMysteryCase, mapGeminiError, toPublicMystery, validateBlueprint, validateEvidenceBundle } from '../src/services/mysteryGeneration.js';

function validBlueprint() {
  const suspect = (key, name) => ({
    key, name, age: 35, background: 'A fictional background.', relationshipToCase: 'A colleague.',
    motive: 'A plausible disagreement.', alibi: 'Claims to have been elsewhere.', relevantInformation: 'Knows the building.',
  });
  return {
    title: 'The Last Bell', description: 'A fictional museum mystery.', scenario: 'A curator is found missing after closing.',
    location: 'North Hall Museum', victim: { name: 'Avery Stone', description: 'The museum curator.' },
    timeline: [
      { at: '6:00 PM', event: 'The museum closes.' },
      { at: '6:20 PM', event: 'The lights briefly fail.' },
      { at: '6:45 PM', event: 'A guard reports the empty office.' },
    ],
    suspects: [suspect('s1', 'Mira Vale'), suspect('s2', 'Jon Bell'), suspect('s3', 'Rin Moss')],
    culpritKey: 's1',
    solution: {
      motive: 'A fictional motive.', whatHappened: 'A fictional explanation.', explanation: 'The evidence reveals the sequence.',
      cluePlan: ['The clock was reset.', 'A message arrived late.', 'The key log was altered.'],
      redHerringPlan: ['A misleading paint stain has an innocent explanation.'],
    },
  };
}

function validEvidence() {
  return {
    evidence: [
      { key: 'e1', title: 'Clock record', type: 'document', content: 'The clock was reset at 6:31 PM.', relevantAt: '2025-01-01T18:31:00Z', relatedSuspectKeys: ['s1'], relatedLocation: 'Office', role: 'decisive_clue', reasoning: 'The reset time conflicts with the alibi.' },
      { key: 'e2', title: 'Message', type: 'chat_message', content: 'A message arrived after the stated meeting.', relevantAt: '2025-01-01T18:32:00Z', relatedSuspectKeys: ['s1'], relatedLocation: 'Office', role: 'decisive_clue', reasoning: 'The message places the sender nearby.' },
      { key: 'e3', title: 'Key log', type: 'document', content: 'One entry was edited.', relevantAt: '2025-01-01T18:33:00Z', relatedSuspectKeys: ['s1'], relatedLocation: 'Security desk', role: 'decisive_clue', reasoning: 'The edit matches the timeline.' },
      { key: 'e4', title: 'Paint note', type: 'written_statement', content: 'A red mark was seen by the door.', relevantAt: '2025-01-01T18:34:00Z', relatedSuspectKeys: ['s2'], relatedLocation: 'Gallery', role: 'red_herring', reasoning: 'The red paint came from a recent repair.' },
      { key: 'e5', title: 'Visitor list', type: 'document', content: 'Three visitors signed out.', relevantAt: '2025-01-01T18:35:00Z', relatedSuspectKeys: ['s2'], relatedLocation: 'Lobby', role: 'supporting', reasoning: 'The visitor list supports the recorded times.' },
      { key: 'e6', title: 'Guard note', type: 'written_statement', content: 'The corridor was quiet.', relevantAt: '2025-01-01T18:36:00Z', relatedSuspectKeys: ['s3'], relatedLocation: 'North Hall', role: 'supporting', reasoning: 'The account matches the quiet period.' },
    ],
  };
}

test('blueprint validator requires a fixed culprit and usable solution', () => {
  const blueprint = validBlueprint();
  assert.equal(validateBlueprint(blueprint).culpritKey, 's1');
  assert.throws(() => validateBlueprint({ ...blueprint, culpritKey: 'unknown' }), /culprit/);
});

test('evidence validator rejects unsupported suspect references', () => {
  const blueprint = validBlueprint();
  const bundle = validEvidence();
  assert.equal(validateEvidenceBundle(bundle, blueprint).evidence.length, 6);
  bundle.evidence[0].relatedSuspectKeys = ['not-a-suspect'];
  assert.throws(() => validateEvidenceBundle(bundle, blueprint), /unknown suspect/);
});

test('evidence validator canonicalizes valid ISO date-times', () => {
  const bundle = validEvidence();
  bundle.evidence[1].relevantAt = '2025-06-10T12:30:00-04:00';
  const normalized = validateEvidenceBundle(bundle, validBlueprint());
  assert.equal(normalized.evidence[1].relevantAt, '2025-06-10T16:30:00.000Z');
});

test('evidence validator replaces Gemini null and non-ISO timestamps from the case timeline', () => {
  const problematicValues = [undefined, null, 'null', '', '6:00 PM', 'At 6:00 PM', '23:00:00Z', 'June 10, 2025 12:30 PM', '2025-02-30T12:00:00Z', '2025-01-01T25:00:00Z'];
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    for (const timestamp of problematicValues) {
      const bundle = validEvidence();
      bundle.evidence[0].relevantAt = timestamp;
      const normalized = validateEvidenceBundle(bundle, validBlueprint());
      assert.equal(normalized.evidence[0].relevantAt, '2025-01-01T18:00:00.000Z');
      for (const evidence of normalized.evidence) {
        assert.match(evidence.relevantAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    }
  } finally {
    console.warn = originalWarn;
  }
});

test('generation endpoint validates requests and returns only generated public data', async (t) => {
  let receivedDifficulty;
  const app = createApp({
    generateMystery: async ({ difficulty }) => {
      receivedDifficulty = difficulty;
      return {
        mystery: { _id: 'case-id', title: 'Public title' },
        suspects: [{ _id: 'suspect-id', name: 'Mira Vale' }],
        evidence: [{ _id: 'evidence-id', title: 'Clock record' }],
      };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/mysteries/generate`;
  const invalid = await fetch(baseUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ difficulty: 'impossible' }),
  });
  assert.equal(invalid.status, 400);

  const response = await fetch(baseUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ difficulty: 'easy' }),
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(receivedDifficulty, 'easy');
  assert.equal('solution' in body.mystery, false);
  assert.equal('culpritKey' in body, false);
});

test('generation endpoint reports missing Gemini configuration without revealing credentials', async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });

  const server = createApp({ generateMystery: generateMysteryCase }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/mysteries/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ difficulty: 'medium' }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Gemini is not configured on the server.' });
});

test('Mystery JSON serialization keeps the stored solution private', () => {
  const mystery = new Mystery({
    title: 'Private test case', description: 'Fictional test', scenario: 'A test scenario',
    solution: { culpritSuspectId: '000000000000000000000001', explanation: 'secret solution text' },
  });
  const serialized = JSON.stringify(mystery);
  assert.equal(serialized.includes('secret solution text'), false);
  assert.equal(serialized.includes('culpritSuspectId'), false);
});

test('public generated mystery includes a stable string ID without exposing its solution', () => {
  const mystery = new Mystery({
    _id: '64b000000000000000000001',
    title: 'Public test case', description: 'Fictional case', scenario: 'A test scenario',
    solution: { culpritSuspectId: '000000000000000000000001', explanation: 'private explanation' },
  });
  const publicCase = toPublicMystery(mystery, [], []);
  assert.equal(publicCase.mystery.id, '64b000000000000000000001');
  assert.equal(String(publicCase.mystery._id), publicCase.mystery.id);
  assert.equal(Object.hasOwn(publicCase.mystery, 'solution'), false);
});

test('Gemini quota errors return clear guidance without provider details', () => {
  const mapped = mapGeminiError({ name: 'RateLimitError', status: 429, message: 'private provider response' });
  assert.equal(mapped.statusCode, 429);
  assert.match(mapped.message, /quota or rate limit reached/i);
  assert.equal(mapped.message.includes('private provider response'), false);
});
