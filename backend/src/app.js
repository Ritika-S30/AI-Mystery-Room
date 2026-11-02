import cors from 'cors';
import express from 'express';
import { createMysteriesRouter } from './routes/mysteries.js';
import { createInvestigationsRouter } from './routes/investigations.js';

function configuredFrontendOrigins() {
  return (process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
}

export function createApp(options = {}) {
  const app = express();

  // Render forwards requests from its load balancer. Trust exactly one proxy
  // hop there; during local development, trust only Vite on loopback.
  app.set('trust proxy', process.env.RENDER === 'true' ? 1 : 'loopback');

  const production = isProductionEnvironment();
  const allowedOrigins = new Set(configuredFrontendOrigins());
  if (!production) {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://127.0.0.1:5173');
    allowedOrigins.add('http://localhost:5174');
    allowedOrigins.add('http://127.0.0.1:5174');
  }

  app.use(cors({
    origin(origin, callback) {
      const isLocalCodespace = !production && /^https:\/\/[a-z0-9-]+\.app\.github\.dev$/i.test(origin || '');
      callback(null, Boolean(origin && (allowedOrigins.has(origin) || isLocalCodespace)));
    },
  }));
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
