# QuizBot AI

QuizBot generates Indonesian multiple-choice quizzes and study tips with the Gemini API.

## Deploy on Vercel

1. Import `https://github.com/loaf684/chatquizai` as a project in Vercel.
2. In **Project Settings → Environment Variables**, add `GEMINI_API_KEY` with a key from Google AI Studio. Do not commit the key or put it in browser code.
3. Optionally add `GEMINI_MODEL` (defaults to `gemini-3.5-flash-lite`).
4. Deploy or redeploy the project.

The app is served from `3_quizbot_real_ai_api.html`; `vercel.json` maps the root URL to it. The `/api` directory contains the serverless functions. Quiz takers can choose 5, 10, or 15 questions and a difficulty level, then review each answer and explanation. The browser history keeps the last 20 attempts per topic and shows recent and best scores.

Quiz settings and up to 20 score attempts per topic are stored in the visitor's browser. History does not sync between devices or browsers.

## Run locally

Requires Node.js 18 or later.

```powershell
$env:GEMINI_API_KEY = "your-gemini-key"
node .\server.js
```

Open `http://localhost:3000`. Never put an API key in an HTML file, commit it, or share it publicly. If a key is exposed, revoke it and create a replacement.
