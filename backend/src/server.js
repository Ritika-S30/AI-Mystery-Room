import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './database.js';

const port = Number(process.env.PORT) || 4000;

try {
  await connectDatabase();
  app.listen(port, () => {
    console.log(`AI Mystery Room API listening on port ${port}`);
  });
} catch (error) {
  console.error(`API startup failed: ${error.message}`);
  process.exitCode = 1;
}
