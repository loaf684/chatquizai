# QuizBot AI

QuizBot generates Indonesian multiple-choice quizzes and study tips with the Gemini API.

## Deploy on Vercel

1. Import `https://github.com/loaf684/chatquizai` as a project in Vercel.
2. In **Project Settings → Environment Variables**, add `GEMINI_API_KEY` with a key from Google AI Studio. Do not commit the key or put it in browser code.
3. Optionally add `GEMINI_MODEL` (defaults to `gemini-3.5-flash-lite`).
4. Deploy or redeploy the project.

The app is served from `3_quizbot_real_ai_api.html`; `vercel.json` maps the root URL to it. The `/api` directory contains the serverless functions. Quiz takers can choose 5, 10, or 15 questions and a difficulty level, then review each answer and explanation. The browser history keeps the last 20 attempts per topic and shows recent and best scores.

### Shared rate limits (recommended)

For rate limits that persist across Vercel function instances, create an Upstash Redis database and set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel. Redeploy after adding them. The API allows 10 request credits per IP per 10 minutes and 40 per day; a 5-question quiz costs 1 credit, a 10-question quiz 2, a 15-question quiz 3, and a study tip 1.

Without both Upstash variables, the app uses an in-memory, per-function-instance limit as a best-effort safeguard. Vercel can run multiple instances or restart them, so that fallback is not a global abuse-prevention guarantee. Gemini's own quota remains controlled by Google AI Studio.

Quiz settings and up to 20 score attempts per topic are stored in the visitor's browser. History does not sync between devices or browsers.

## Run locally

Requires Node.js 18 or later.

```powershell
$env:GEMINI_API_KEY = "your-gemini-key"
node .\server.js
```

Open `http://localhost:3000`. Never put an API key in an HTML file, commit it, or share it publicly. If a key is exposed, revoke it and create a replacement.
