import assert from 'node:assert/strict';
import test from 'node:test';
import { assertHintAllowance, calculateScore, DIFFICULTY_RULES } from '../src/gameRules.js';

test('difficulty rules match the workshop suspect, clue, hint, and base score requirements', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(DIFFICULTY_RULES).map(([key, rule]) => [key, [rule.suspects, rule.clues, rule.hints, rule.baseScore]])), {
    easy: [3, 5, 2, 100],
    medium: [4, 7, 3, 150],
    hard: [5, 9, 3, 200],
  });
});

test('scores add five points per discovered clue and subtract ten per hint', () => {
  assert.equal(calculateScore({ difficulty: 'easy', discoveredClues: 5, hintsUsed: 2 }), 105);
  assert.equal(calculateScore({ difficulty: 'medium', discoveredClues: 7, hintsUsed: 3 }), 155);
  assert.equal(calculateScore({ difficulty: 'hard', discoveredClues: 9, hintsUsed: 3 }), 215);
  assert.equal(calculateScore({ difficulty: 'easy', discoveredClues: 0, hintsUsed: 99 }), 0);
});

test('hint requests stop at each difficulty allowance', () => {
  assert.equal(assertHintAllowance({ difficulty: 'easy', hintsUsed: 1 }), true);
  assert.equal(assertHintAllowance({ difficulty: 'easy', hintsUsed: 2 }), false);
  assert.equal(assertHintAllowance({ difficulty: 'medium', hintsUsed: 2 }), true);
  assert.equal(assertHintAllowance({ difficulty: 'medium', hintsUsed: 3 }), false);
  assert.equal(assertHintAllowance({ difficulty: 'hard', hintsUsed: 3 }), false);
});
