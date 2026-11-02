import cors from 'cors';
import express from 'express';
import { createMysteriesRouter } from './routes/mysteries.js';
import { createInvestigationsRouter } from './routes/investigations.js';

export function createApp(options = {}) {
  const app = express();

  // Vite proxies API calls over loopback. Trust only that local proxy so
  // express-rate-limit can use the forwarded client address without trusting
  // arbitrary X-Forwarded-For headers from direct clients.
  app.set('trust proxy', 'loopback');
  app.use(cors());
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'ai-mystery-room-api' });
  });
  app.use('/api/mysteries', createMysteriesRouter(options));
  app.use('/api/investigations', createInvestigationsRouter({ service: options.investigationService }));

  return app;
}

const app = createApp();

export default app;
