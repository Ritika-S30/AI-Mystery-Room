import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/database.js';

test('connection refuses to start when MONGODB_URI is missing', async () => {
  await assert.rejects(
    connectDatabase({ uri: '' }),
    { message: /MONGODB_URI is not set/ },
  );
  assert.equal(mongoose.connection.readyState, 0);
});

test('connection errors do not reveal credentials from the URI', async () => {
  const username = 'private-test-user';
  const password = 'private-test-password';
  await assert.rejects(
    connectDatabase({
      uri: `mongodb://127.0.0.1:1/ai-mystery-room?authSource=admin&username=${username}&password=${password}`,
      serverSelectionTimeoutMS: 50,
    }),
    (error) => {
      assert.match(error.message, /Could not connect to MongoDB/);
      assert.equal(error.message.includes(username), false);
      assert.equal(error.message.includes(password), false);
      return true;
    },
  );
});
