# AI Text Fixer

Upload a social media post, ad, banner, or screenshot, and let AI read the
visible text and check it for spelling, grammar, punctuation, clarity, and
marketing-copy quality before you publish.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **Zod** for validating the AI model's structured response
- **Google Gemini** (`gemini-2.0-flash`, vision-capable) as the default AI provider — swap the implementation in `lib/ai.ts` for another vision model if you prefer

## Getting started locally

```bash
npm install
cp .env.local.example .env.local
# then edit .env.local and add your Gemini API key
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server-side only. Used in `lib/ai.ts` to call the Gemini API. Never exposed to the browser. |

`.env.local` is already listed in `.gitignore` — never commit real API keys.

## How it works

1. The user uploads an image on `/analyze` (drag-and-drop, click-to-upload, or the built-in example).
2. The image is sent as `multipart/form-data` to `POST /api/analyze`.
3. The API route validates the file (type + size), converts it to base64, and sends it to Gemini with a dedicated system prompt asking it to act as a copy editor, grammar checker, and social-media copy reviewer, returning **only** structured JSON.
4. The JSON response is parsed and validated against a Zod schema (`lib/validation.ts`). If it fails validation, or the request fails for any reason, the API returns a clear error — the app never fabricates a result.
5. The frontend renders a results dashboard: overall status, extracted text, flagged issues, a corrected version of the copy, and a marketing-copy review.
6. Each analysis is saved to `localStorage` so it shows up on `/history`. No server-side database or file storage is used yet — see "Adding a database" below.

## Project structure

```
app/
  page.tsx              Landing page
  analyze/page.tsx       Upload + analysis workflow
  history/page.tsx       Local analysis history
  api/analyze/route.ts    Server route that calls the AI provider
components/
  upload-dropzone.tsx, image-preview.tsx, analysis-loader.tsx,
  overall-status.tsx, extracted-text.tsx, issue-card.tsx,
  correction-card.tsx, copy-review.tsx, copy-button.tsx,
  analysis-summary.tsx, analysis-result.tsx, empty-state.tsx,
  error-state.tsx, hero-annotation.tsx, site-nav.tsx, site-footer.tsx
  ui/                    button.tsx, badge.tsx, card.tsx
lib/
  ai.ts                  AI provider call + system prompt
  validation.ts           Zod schemas + file validation
  types.ts                Shared TypeScript types
  utils.ts                Formatting + clipboard helpers
  history.ts              localStorage-backed history
  demo.ts                 Fixed data for "Try an example"
public/demo/example.svg   Sample design used by demo mode
```

## Deploying to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, click **New Project** and import the repository.
3. Vercel will detect Next.js automatically — no build settings to change.
4. Under **Environment Variables**, add `GEMINI_API_KEY` with your key.
5. Click **Deploy**.
6. Once deployed, open `/analyze` on your new domain and upload a test image to confirm the API route works in Vercel's serverless environment.

The app doesn't write to the local filesystem and doesn't persist uploaded
images anywhere — every request is processed in memory, which fits Vercel's
serverless model without changes.

## Adding a database later

`lib/history.ts` isolates all history read/write calls behind three functions
(`getHistory`, `saveHistoryEntry`, `clearHistory`). To move history to a real
backend (e.g. Supabase):

1. Add authentication (e.g. Supabase Auth, Clerk, NextAuth).
2. Replace the bodies of those three functions with calls to your database,
   keyed by user ID.
3. No component code needs to change — they only depend on that module's
   exported functions and the `HistoryEntry` type in `lib/types.ts`.

## Rate limiting

`app/api/analyze/route.ts` includes a minimal in-memory rate limiter as a
starting point. It resets whenever a serverless instance recycles, so for
real production traffic swap it for a distributed store such as Upstash
Redis (`@upstash/ratelimit`) — the call site is isolated in one function
(`isRateLimited`) to make that swap straightforward.

## Notes on accuracy

Every result is an AI-generated read of the uploaded image, not a
guarantee. OCR can misread stylized fonts, low-contrast text, or heavily
cropped designs — the UI surfaces the model's own confidence and flags low
confidence explicitly so users know to double check against the original.
