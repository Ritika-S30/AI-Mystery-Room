export const DIFFICULTY_RULES = Object.freeze({
  easy: Object.freeze({ suspects: 3, clues: 5, hints: 2, baseScore: 100 }),
  medium: Object.freeze({ suspects: 4, clues: 7, hints: 3, baseScore: 150 }),
  hard: Object.freeze({ suspects: 5, clues: 9, hints: 3, baseScore: 200 }),
});

export function calculateScore({ difficulty, discoveredClues = 0, hintsUsed = 0 }) {
  const rules = DIFFICULTY_RULES[difficulty];
  if (!rules) throw new Error('A valid difficulty is required to calculate score.');
  const clues = Number.isInteger(discoveredClues) ? Math.max(0, discoveredClues) : 0;
  const hints = Number.isInteger(hintsUsed) ? Math.max(0, hintsUsed) : 0;
  return Math.max(0, rules.baseScore + clues * 5 - hints * 10);
}

export function assertHintAllowance({ difficulty, hintsUsed = 0 }) {
  const rules = DIFFICULTY_RULES[difficulty];
  if (!rules) throw new Error('A valid difficulty is required to check hint allowance.');
  return hintsUsed < rules.hints;
}
