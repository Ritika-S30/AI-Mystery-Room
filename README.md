# AI Mystery Room

An interactive mystery investigation web app. The project has a React frontend and an Express backend, with MongoDB models and an environment-based connection.

The MVP lets a player create a Gemini-generated case, inspect suspects and evidence, follow the case timeline, mark evidence reviewed, save notes, request evidence-based hints, and accuse a suspect. Investigations are saved to MongoDB and can be resumed in the same browser. The backend keeps the culprit and solution private until an accusation is submitted.

## Requirements

- Node.js 18 or newer
- npm

## Run the frontend

```sh
cd frontend
npm install
npm run dev
```

Vite prints the local URL after startup (usually `http://localhost:5173`).
The development server proxies `/api` requests to the backend on port 4000.

## Run the backend

In another terminal:

```sh
cd backend
cp .env.example .env
npm install
npm run dev
```

Add your MongoDB Atlas connection string to `backend/.env` as `MONGODB_URI`. The API listens on port 4000 by default. Check it at `http://localhost:4000/api/health`.
Set `GEMINI_API_KEY` in the same backend `.env` file. `GEMINI_MODEL` is optional and defaults to `gemini-3.5-flash-lite`. Never put the Gemini key in frontend configuration.

## Connect a free MongoDB Atlas database

1. Create an account at [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database) and create a free shared cluster.
2. In Atlas, create a **database user** with a strong password. This is separate from your Atlas website login.
3. Under **Network Access**, add your current IP address so your development machine can connect. Avoid allowing access from every IP.
4. Select **Connect**, choose **Drivers**, and copy the Node.js connection string.
5. Put it in `backend/.env`, replacing the placeholders with the database username, password, and cluster host:

   ```dotenv
   MONGODB_URI=mongodb+srv://<database-user>:<password>@<cluster-host>/ai-mystery-room?retryWrites=true&w=majority
   ```

   URL-encode special characters in the password. Keep this value in the ignored `.env` file; never commit it or place it in frontend variables.
6. Run `npm run dev` from `backend/`, then visit `http://localhost:4000/api/health`.

The `.env.example` file contains placeholders only. Get a Gemini API key through [Google AI Studio](https://aistudio.google.com/app/apikey) and set `GEMINI_API_KEY` in the ignored `backend/.env` file.

## Generate a mystery

With MongoDB and Gemini configured and the backend running, send `POST /api/mysteries/generate` with an optional difficulty:

```json
{ "difficulty": "medium" }
```

The endpoint returns public case details, suspects, and evidence. The culprit, solution, and red-herring explanations remain in protected backend data. Generation is limited to three requests per IP every ten minutes. Gemini quota/rate-limit responses are reported as a clear retry/configuration message.

## Investigation API

- `POST /api/investigations` creates a saved investigation for a generated mystery.
- `GET /api/investigations` lists the current browser guest's saved cases.
- `GET /api/investigations/:id` loads the public case workspace.
- `POST /api/investigations/:id/notes` saves a note, optionally linked to evidence.
- `POST /api/investigations/:id/evidence/:evidenceId/review` records reviewed evidence.
- `POST /api/investigations/:id/hint` requests a safe hint from Gemini.
- `POST /api/investigations/:id/accuse` checks an accusation and permits the solution reveal.
- `GET /api/investigations/:id/solution` returns the solution only after an accusation.

Investigation endpoints use the `x-guest-id` header managed by the frontend. Clearing browser storage removes access to that browser's guest investigations.

## Test the backend

```sh
cd backend
npm test
```
