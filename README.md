# AI Text Fixer

Upload a social media post, ad, banner, or screenshot — by file picker,
drag-and-drop, or pasting straight from your clipboard — and let AI read
the visible text and check it for spelling, grammar, punctuation,
capitalization consistency, keyword consistency, and marketing-copy
quality before you publish.

It can also **recreate an existing post**: upload a design and have AI
analyze its text, layout, typography, colors and visual elements, then
rebuild it as a clean, professional, editable HTML/CSS design you can
preview side by side, regenerate, improve, fix the copy on, and export
as PNG or JPG — see [Recreate this post](#recreate-this-post).

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
| `GEMINI_API_KEY` | Yes* | Server-side only. Single primary key — the simplest setup. |
| `GEMINI_API_KEY_1` | Yes* | Server-side only. First key of the ordered failover list. Either this or `GEMINI_API_KEY` must be set. |
| `GEMINI_API_KEY_2` … `GEMINI_API_KEY_5` | No | Additional keys tried in order if an earlier key hits a transient error. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.6-flash`. Confirm this exact model name is available to your key/API version — a wrong name fails fast with a clear config error rather than retrying every key (see "Gemini failover" below). |
| `GEMINI_MODEL_FALLBACK` | No | Only tried if **every** key fails against `GEMINI_MODEL` for a non-fatal reason (sustained 503/429/5xx). Useful when a whole model tier — not just one key — is under demand pressure; point it at a different tier, e.g. `gemini-3.1-flash-lite`. |

\* If **no** key is configured, both AI routes answer
`{ "error": "Gemini API key is not configured.", "code": "missing_api_key" }`
(HTTP 503) and the UI shows "AI service is not configured. Please contact
the administrator." Keys are read server-side only — never expose them
with a `NEXT_PUBLIC_` prefix.

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

### If you're seeing "AI service is temporarily busy"

That message means **every** configured key failed against the configured model — the app is refusing to fabricate a result rather than showing a fake analysis. To find the actual cause:

1. Open your Vercel project → **Logs** (or your terminal if running locally) and look for the `[gemini]` lines from the request that just failed. The last line before the final error tells you exactly what happened per key — e.g. all keys hit 503, or one hit 401.
2. **All keys hit 401** → your keys aren't set correctly in this environment. Double check `GEMINI_API_KEY_1` (etc.) are present under the right Vercel environment (Production vs Preview vs Development use separate variables) and redeploy after adding them — env var changes don't apply to already-running deployments.
3. **All keys hit 503/429 repeatedly, including after retries** → this is a genuine Gemini-side demand spike or project-level quota limit, not a bug in the failover logic — see the "not extra quota" note above. Set `GEMINI_MODEL_FALLBACK` to a different model tier (e.g. `gemini-3.1-flash-lite`) so a sustained outage on one model doesn't take down the whole app.
4. **One key hits 404 immediately, no retries logged** → `GEMINI_MODEL` (or `GEMINI_MODEL_FALLBACK`) is set to a model name that doesn't exist or isn't available to your key — the fatal-error path is working as designed here; fix the env var rather than adding more keys.
5. **Nothing in the logs at all** → the request likely isn't reaching `analyzeImageWithAi` — check the rate limiter in `route.ts` isn't rejecting it (429 before ever calling Gemini) or that the request didn't fail file validation.

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

## Recreate & compare post

The second workflow: `/recreate` (also reachable from the "Recreate
Post" choice on `/analyze` after you pick an image, from the nav, or
from the homepage link).

**Principle: same design, better text presentation.** The AI recreates
the uploaded post as closely as possible — same layout, background,
images, logo, colors, shapes, positions and overall style — and focuses
its improvements on the text.

**Flow:** upload → choose a format → analyze the original → extract
visible text → check sentence case / Title Case / uppercase → check
text alignment → check spacing & hierarchy → recreate the same post →
**Original vs corrected** preview (side by side, plus a before/after
slider) → what-improved report, per-element text analysis table and
design improvement summary → regenerate / improve / fix text / reset →
download as **PNG** or **JPG**.

Report sections rendered by `components/text-report.tsx`:

- **What improved?** — `improvementReport[]`, one entry per category
  (`capitalization`, `alignment`, `spacing`, `hierarchy`, `readability`,
  `cta`, `grammar`) with a `kind` of `definite_problem`,
  `design_improvement`, or `correct`. Already-correct elements are
  reported explicitly (e.g. "Title Case is appropriate for this
  headline") instead of being changed.
- **Text analysis** — `textAnalysis[]`: original vs. recommended text
  per element, current vs. recommended capitalization style, alignment,
  a reason, and a status badge (**✓ Correct / ⚠ Improve / ✕
  Incorrect**).
- **Design improvement summary** — `summary`: overall improvement, text
  accuracy %, and alignment / capitalization / hierarchy / readability
  values, labelled as an **AI-generated assessment**, not a measurement.

- `app/api/recreate/route.ts` — validates the upload and format,
  supports three modes passed as `mode`:
  - `create` — full first recreation (temperature 0.4).
  - `regenerate` — same source image, a different variant (temperature 0.6);
    the previous result is sent back as `previous` so the model varies the
    layout instead of repeating itself.
  - `improve` — refinement pass with `improvements` notes
    (spacing, typography, alignment, contrast, visual hierarchy, CTA visibility).
- `lib/recreate.ts` — the dedicated server-side system instruction
  (graphic designer + typography specialist + social media designer +
  professional copy editor) and `recreatePostWithAi()`;
  `lib/validation.ts` — `RecreateResultSchema`, `TextElementAssessmentSchema`,
  `ImprovementItemSchema` and `DesignSummarySchema`, validated with Zod
  before anything reaches the UI. The report fields are optional so
  older results still validate; the UI falls back to the plain
  `improvements` list when they are absent.
- `components/recreated-post.tsx` — renders the result as real,
  editable HTML/CSS layers (background, logo/icon row, image area,
  label, headline, subtitle, body, price, CTA, meta) across five layout
  templates with responsive scaling and the five design fonts loaded in
  `app/layout.tsx` as CSS variables.
- `components/recreate-preview.tsx` — "Original vs corrected post"
  comparison view, action bar, palette/meta tiles, and an offscreen 1x
  node rasterized at export resolution with `html-to-image`.
- **Fix text** reuses `/api/analyze`: the corrected copy is mapped onto
  the recreation's text hierarchy (headline / subtitle / body / CTA /
  label) without touching the design.
- **Reset** pops an in-memory `past` stack of previous results, so you
  can step back through your edit history.
- `lib/recreate-store.ts` — an in-memory, module-scoped handoff of the
  uploaded file from `/analyze` to `/recreate`; nothing is persisted,
  so opening `/recreate` directly just shows its own dropzone.

Rate-limited per route like `/api/analyze`, and it returns the same
missing-key / "AI service is temporarily busy" error contract.

## Project structure

```
app/
  page.tsx              Landing page
  analyze/page.tsx       Upload + paste + "Analyze Text / Recreate Post" choice
  recreate/page.tsx      Recreate-this-post workflow (analyze → recreate → export)
  history/page.tsx       Local analysis history
  api/analyze/route.ts    Server route that calls lib/ai.ts
  api/recreate/route.ts   Server route for recreation (create/regenerate/improve)
components/
  upload-dropzone.tsx, screenshot-paste.tsx, image-preview.tsx,
  analysis-loader.tsx, analysis-result.tsx, overall-status.tsx,
  extracted-text.tsx, issue-card.tsx, case-analysis.tsx,
  keyword-analysis.tsx, correction-card.tsx, copy-review.tsx,
  copy-button.tsx, analysis-summary.tsx, empty-state.tsx,
  error-state.tsx, hero-annotation.tsx, site-nav.tsx, site-footer.tsx
  recreated-post.tsx, recreate-preview.tsx, recreate-loader.tsx,
  post-format-select.tsx
  ui/                    button.tsx, badge.tsx, card.tsx
lib/
  ai.ts                  Gemini failover + system prompt (see above)
  gemini.ts              Shared server-side Gemini transport (used by ai.ts + recreate.ts)
  recreate.ts            Recreation system prompt + recreatePostWithAi()
  recreate-store.ts      Ephemeral file handoff /analyze → /recreate
  formats.ts             Post formats, color/contrast helpers, normalizeRecreation()
  export-image.ts        PNG/JPG export registry + download helpers
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
   - `GEMINI_API_KEY` (required — or use the numbered list below instead)
   - `GEMINI_API_KEY_1` (required if you don't set `GEMINI_API_KEY`)
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

`app/api/analyze/route.ts` and `app/api/recreate/route.ts` each include
a minimal in-memory rate limiter as
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
