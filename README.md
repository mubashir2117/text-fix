# AI Text Fixer

Upload a social media post, ad, banner, or screenshot — by file picker,
drag-and-drop, or pasting straight from your clipboard — and let AI read
the visible text and check it for spelling, grammar, punctuation,
capitalization consistency, keyword consistency, and marketing-copy
quality before you publish.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **Zod** for validating the AI model's structured response
- **Google Gemini** (vision-capable, model configurable via `GEMINI_MODEL`) with **multi-key failover** — see below

## Getting started locally

```bash
npm install
cp .env.local.example .env.local
# then edit .env.local and add at least GEMINI_API_KEY_1
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY_1` | Yes | Server-side only. Primary Gemini API key. |
| `GEMINI_API_KEY_2` … `GEMINI_API_KEY_5` | No | Additional keys tried in order if an earlier key hits a transient error. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.6-flash`. Confirm this exact model name is available to your key/API version — a wrong name fails fast with a clear config error rather than retrying every key (see "Gemini failover" below). |

`.env.local` is already listed in `.gitignore` — never commit real API keys.

## Gemini failover

`lib/ai.ts` collects every configured `GEMINI_API_KEY_n` into an ordered
list and works through it when a request hits a **transient** error:

```
KEY 1 → 503 → retry KEY 1 (backoff) → still failing → KEY 2
KEY 2 → succeeds → return result
```

**Important — this is redundancy, not extra quota.** Gemini's rate
limits are enforced per Google Cloud *project*. If `GEMINI_API_KEY_1`
and `GEMINI_API_KEY_2` belong to the same project, rotating between
them does **not** raise your effective rate limit — a 429 from one key
usually means the project is throttled, and the other key from the
same project will likely hit the same wall. What multiple keys *do*
buy you:

- Resilience if one key is individually revoked, deleted, or misconfigured.
- Real load distribution, but only if the keys are genuinely separate,
  independently billed Google Cloud projects.

Don't provision multiple keys from one project as a way to bypass
Google's quota — it won't work, and it obscures the real signal that
you need to request a quota increase or reduce request volume.

### What triggers failover to the next key

| Response | Behavior |
| --- | --- |
| `503` (`UNAVAILABLE`) | Retry the *same* key with exponential backoff + jitter (max 2 retries), then move to the next key. |
| `500` / `502` / `504` | Same as 503 — transient, retry then fail over. |
| `429` (`RESOURCE_EXHAUSTED`) | Wait for the `Retry-After` header if Gemini sent one (otherwise backoff), retry once, then fail over. |
| Timeout (30–45s, `AbortController`) or network failure | Treated as transient — retry then fail over. |
| A response that isn't valid JSON matching `AiAnalysisSchema` | Retried once on the same key (generation is non-deterministic), then fails over — never returned to the frontend unvalidated. |

### What does NOT retry the same key repeatedly

| Response | Behavior |
| --- | --- |
| `401` | Treated as an invalid/unauthorized key — moves to the next key immediately, no retries wasted. |
| `400` / `403` | Recorded, then moves to the next key without retrying — repeating an identical bad request rarely succeeds. |
| `404` (model not found) | **Not** treated as a per-key problem — every key shares the same `GEMINI_MODEL`, so a wrong model name fails immediately with a configuration error instead of burning through every key. |

If every configured key is exhausted, `lib/ai.ts` throws
`AiAnalysisError("All configured AI providers are temporarily unavailable.", ...)`
with the per-key failure reasons attached as `cause` — it never
fabricates a result.

### Logging

Every attempt logs a key **label** (`key-1`, `key-2`, …), never the key
value, and never the base64 image payload:

```
[gemini] Attempt 1 using key-1
[gemini] key-1 -> Gemini returned 503 (temporary provider error).
[gemini] Retrying key-1 in ~1042ms
[gemini] key-1 exhausted its retries — switching to next key
[gemini] Switching to key-2
[gemini] Attempt 1 using key-2
[gemini] Request succeeded using key-2
```

### Testing failover locally

1. Set `GEMINI_API_KEY_1` to an intentionally invalid string (e.g. `invalid-key-1`) and `GEMINI_API_KEY_2` to a real, working key.
2. Run `npm run dev` and upload an image on `/analyze`.
3. Watch the terminal: you should see `key-1 -> Gemini returned 401 ...` followed immediately by `Switching to key-2` and then `Request succeeded using key-2` — with the UI still returning a normal result, no error shown to the user.
4. To simulate a 503 instead of an outright invalid key, temporarily point `GEMINI_API_KEY_1` at a key that's over its project quota (or has been suspended) so Gemini itself returns 503/429 — you should see the retry-with-backoff lines before it switches keys.

## The case, capitalization & keyword checks

The system prompt in `lib/ai.ts` explicitly instructs the model to treat
capitalization as **contextual, not a fixed rule** — Sentence case,
Title Case, and ALL CAPS can all be intentional design choices, and the
model is told not to flag a headline just for being uppercase. It only
flags capitalization when it's inconsistent with the style the design
itself establishes, and it's told never to invent a "correct"
capitalization for brand names it hasn't seen used consistently
somewhere in the image.

The model returns three additive fields (all optional in
`AiAnalysisSchema`, so nothing breaks if an older cached result lacks
them):

- **`textBlocks`** — each detected text block (headline, subheadline, body, CTA, label) with its detected case style.
- **`keywordAnalysis`** — repeated keywords/brand terms with every variant spotted and whether they're used consistently.
- **`caseAnalysis`** — a pass/warning/fail summary across sentence case, title case, keyword capitalization, and proper nouns.

These render as two new result-page sections: `components/case-analysis.tsx` and `components/keyword-analysis.tsx`, both skipped entirely if the fields are absent.

## Screenshot paste

`components/screenshot-paste.tsx` exports:

- **`useClipboardPaste(onImage, enabled)`** — a `window` `paste` event listener that detects an image on the clipboard, validates it exactly like a file upload, and hands it to the same `handleFileSelected` path — active only while the analyze page is idle, so a stray paste elsewhere doesn't clobber an image you've already selected.
- **`PasteScreenshotButton`** — tries `navigator.clipboard.read()` on click (works in Chromium-based browsers with permission); if that API isn't available or permission is denied, it falls back to a toast telling the person to press Ctrl+V / Cmd+V, which the listener above still picks up.

No screenshot is ever required to be saved to disk first.

## Project structure

```
app/
  page.tsx              Landing page
  analyze/page.tsx       Upload + paste + analysis workflow
  history/page.tsx       Local analysis history
  api/analyze/route.ts    Server route that calls lib/ai.ts
components/
  upload-dropzone.tsx, screenshot-paste.tsx, image-preview.tsx,
  analysis-loader.tsx, analysis-result.tsx, overall-status.tsx,
  extracted-text.tsx, issue-card.tsx, case-analysis.tsx,
  keyword-analysis.tsx, correction-card.tsx, copy-review.tsx,
  copy-button.tsx, analysis-summary.tsx, empty-state.tsx,
  error-state.tsx, hero-annotation.tsx, site-nav.tsx, site-footer.tsx
  ui/                    button.tsx, badge.tsx, card.tsx
lib/
  ai.ts                  Gemini failover + system prompt (see above)
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
4. Under **Settings → Environment Variables**, add for each environment you deploy (Production / Preview / Development):
   - `GEMINI_API_KEY_1` (required)
   - `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, … as needed (optional)
   - `GEMINI_MODEL` (optional — omit to use the default)
5. Click **Deploy**.
6. Once deployed, open `/analyze` on your new domain, upload a test image, and check the **Runtime Logs** tab in Vercel for the `[gemini]` log lines described above to confirm which key served the request.

The app doesn't write to the local filesystem and doesn't persist
uploaded images anywhere — every request is processed in memory, which
fits Vercel's serverless model without changes. `app/api/analyze/route.ts`
sets `export const runtime = "nodejs"` and `maxDuration = 60` to give
the failover loop room to retry across keys within one request.

## Adding a database later

`lib/history.ts` isolates all history read/write calls behind three
functions (`getHistory`, `saveHistoryEntry`, `clearHistory`). To move
history to a real backend (e.g. Supabase):

1. Add authentication (e.g. Supabase Auth, Clerk, NextAuth).
2. Replace the bodies of those three functions with calls to your database, keyed by user ID.
3. No component code needs to change — they only depend on that module's exported functions and the `HistoryEntry` type in `lib/types.ts`.

## Rate limiting

`app/api/analyze/route.ts` includes a minimal in-memory rate limiter as
a starting point, separate from the Gemini-side failover described
above — this one limits how often *your own users* can call your API,
not how Gemini responds. It resets whenever a serverless instance
recycles, so for real production traffic swap it for a distributed
store such as Upstash Redis (`@upstash/ratelimit`); the call site is
isolated in one function (`isRateLimited`) to make that swap
straightforward.

## Notes on accuracy

Every result is an AI-generated read of the uploaded image, not a
guarantee. OCR can misread stylized fonts, low-contrast text, or
heavily cropped designs — the UI surfaces the model's own confidence
and flags low confidence explicitly so users know to double check
against the original. Bounding-box highlighting of individual text
regions on the image was intentionally left out of this version: Gemini
doesn't reliably ground text to pixel coordinates for arbitrary social
media layouts, and fabricating approximate boxes would be worse than
not drawing any — the issue cards link definite errors to exact text
snippets instead, which doesn't depend on spatial accuracy.
