import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { generateMysteryCase, MysteryGenerationError } from '../services/mysteryGeneration.js';

const generationLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many generation requests. Please try again later.' },
});

export function createMysteriesRouter({ generateMystery = generateMysteryCase } = {}) {
  const router = Router();

  router.post('/generate', generationLimit, async (request, response) => {
    const body = request.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return response.status(400).json({ error: 'Request body must be an object.' });
    }
    const unexpectedFields = Object.keys(body).filter((key) => key !== 'difficulty');
    if (unexpectedFields.length > 0) {
      return response.status(400).json({ error: 'Only the difficulty field is accepted.' });
    }
    const difficulty = body.difficulty ?? 'medium';
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return response.status(400).json({ error: 'Difficulty must be easy, medium, or hard.' });
    }

    try {
      const generated = await generateMystery({ difficulty });
      return response.status(201).json(generated);
    } catch (error) {
      if (error instanceof MysteryGenerationError) {
        return response.status(error.statusCode).json({ error: error.message });
      }
      return response.status(500).json({ error: 'Mystery generation failed.' });
    }
  });

  return router;
}
