import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './database.js';

const configuredPort = process.env.PORT;
const port = configuredPort === undefined || configuredPort === '' ? 4000 : Number(configuredPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be a valid TCP port number.');
  process.exitCode = 1;
} else {
  try {
    await connectDatabase();
    app.listen(port, '0.0.0.0', () => {
      console.log(`AI Mystery Room API listening on port ${port}`);
    });
  } catch (error) {
    console.error(`API startup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
