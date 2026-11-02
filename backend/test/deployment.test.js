import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';

async function withServer(t, app) {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function setEnvironment(values) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test('development CORS allows local Vite and Codespaces origins but not unrelated sites', async (t) => {
  const restore = setEnvironment({ NODE_ENV: 'development', RENDER: undefined, FRONTEND_URL: '' });
  const app = createApp();
  restore();
  const base = await withServer(t, app);

  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://my-codespace-5173.app.github.dev']) {
    const response = await fetch(`${base}/api/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }

  const blocked = await fetch(`${base}/api/health`, { headers: { Origin: 'https://unrelated.example' } });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.headers.has('access-control-allow-origin'), false);
});

test('production CORS allows only configured frontend origins and trusts Render proxy hop', async (t) => {
  const restore = setEnvironment({
    NODE_ENV: 'production',
    RENDER: 'true',
    FRONTEND_URL: 'https://mystery-room.example/, https://preview.example',
  });
  const app = createApp();
  restore();
  assert.equal(app.get('trust proxy'), 1);
  const base = await withServer(t, app);

  const allowed = await fetch(`${base}/api/health`, { headers: { Origin: 'https://mystery-room.example' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://mystery-room.example');

  const blocked = await fetch(`${base}/api/health`, { headers: { Origin: 'https://localhost:5173' } });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.headers.has('access-control-allow-origin'), false);
});
