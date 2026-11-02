import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  InvestigationError,
  accuseSuspect,
  addNote,
  createInvestigation,
  getSolution,
  getWorkspace,
  isGuestId,
  listInvestigations,
  markEvidenceReviewed,
  requestHint,
} from '../services/investigations.js';

const assistantLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'The assistant is busy. Please try again in a few minutes.' },
});

export function createInvestigationsRouter({ service = {
  create: createInvestigation,
  list: listInvestigations,
  workspace: getWorkspace,
  note: addNote,
  review: markEvidenceReviewed,
  hint: requestHint,
  accuse: accuseSuspect,
  solution: getSolution,
} } = {}) {
  const router = Router();

  async function handle(response, action) {
    try {
      const result = await action();
      return response.status(result?.statusCode ?? 200).json(result?.body ?? result);
    } catch (error) {
      if (error instanceof InvestigationError) {
        return response.status(error.statusCode).json({ error: error.message });
      }
      return response.status(500).json({ error: 'Investigation request failed.' });
    }
  }

  router.post('/', (request, response) => {
    const body = request.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) return response.status(400).json({ error: 'Request body must be an object.' });
    if (Object.keys(body).some((key) => !['mysteryId', 'guestId'].includes(key))) {
      return response.status(400).json({ error: 'Only mysteryId and guestId are accepted.' });
    }
    const headerGuestId = request.get('x-guest-id');
    if (body.guestId !== undefined && !isGuestId(body.guestId)) return response.status(400).json({ error: 'Guest session must be a valid UUID.' });
    if (headerGuestId && body.guestId && headerGuestId !== body.guestId) return response.status(400).json({ error: 'Guest session values must match.' });
    const guestId = headerGuestId || body.guestId;
    return handle(response, () => service.create({ mysteryId: body.mysteryId, guestId }));
  });

  router.get('/', (request, response) => handle(response, () => service.list({ guestId: request.get('x-guest-id') })));

  router.get('/:investigationId', (request, response) => handle(response, () => service.workspace({
    investigationId: request.params.investigationId,
    guestId: request.get('x-guest-id'),
  })));

  router.post('/:investigationId/notes', (request, response) => {
    const body = request.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['text', 'evidenceId'].includes(key))) {
      return response.status(400).json({ error: 'Provide note text and an optional evidenceId.' });
    }
    return handle(response, async () => ({
      investigation: await service.note({
        investigationId: request.params.investigationId,
        guestId: request.get('x-guest-id'),
        text: body.text,
        evidenceId: body.evidenceId,
      }),
    }));
  });

  router.post('/:investigationId/evidence/:evidenceId/review', (request, response) => handle(response, async () => ({
    investigation: await service.review({
      investigationId: request.params.investigationId,
      guestId: request.get('x-guest-id'),
      evidenceId: request.params.evidenceId,
    }),
  })));

  router.post('/:investigationId/hint', assistantLimit, (request, response) => {
    const body = request.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'question')) {
      return response.status(400).json({ error: 'Only an optional question is accepted.' });
    }
    return handle(response, () => service.hint({
      investigationId: request.params.investigationId,
      guestId: request.get('x-guest-id'),
      question: body.question ?? '',
    }));
  });

  router.post('/:investigationId/accuse', (request, response) => {
    const body = request.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'suspectId')) {
      return response.status(400).json({ error: 'Provide a suspectId to make an accusation.' });
    }
    return handle(response, () => service.accuse({
      investigationId: request.params.investigationId,
      guestId: request.get('x-guest-id'),
      suspectId: body.suspectId,
    }));
  });

  router.get('/:investigationId/solution', (request, response) => handle(response, async () => ({
    solution: await service.solution({
      investigationId: request.params.investigationId,
      guestId: request.get('x-guest-id'),
    }),
  })));

  return router;
}
