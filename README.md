# SkinIQ

**Personalized skincare ingredient analysis.** Build a quick skin profile,
snap a photo of any product's ingredient list, and get an explainable
**compatibility score** — how well that product's ingredients actually fit
*your* skin type, concerns, and allergies.

🔗 **Live demo:** https://skin-iq-pi.vercel.app

> SkinIQ gives an *explainable estimate*, not a quality grade. An AI grades each
> ingredient against your skin concerns, and a pure, deterministic function turns
> those grades into the number — so the same product always scores the same way.

---

## What it does

1. **Build your profile** — skin type, sensitive / acne-prone traits, concerns
   (acne, redness, dryness, dark spots…), and any ingredient allergies.
2. **Scan a product** — photograph the **back** (ingredient list, required) and
   optionally the **front** (for the product name, category, and a nicer cover).
3. **Get a report** — an overall match score, a verdict, a per-concern breakdown,
   plain-language highlights / cautions / benefits, how-to-use guidance, and
   notes on individual ingredients. Allergy hits are flagged.
4. **Save & revisit** — signed-in users get a private history; reports are
   private by default and shareable only via an opt-in, unguessable link.

## How it works

- **Reads the label** with Google Gemini, behind a **validation gate** — a photo
  that isn't a real ingredient list is rejected instead of scored, so you never
  get a fabricated analysis.
- **Grades ingredients** against your concerns using a growing **knowledge base**:
  each ingredient is AI-graded once (grounded by the EU **CosIng** dataset),
  then cached and shared forever. Grades are bounded, three-state values
  (`helps` / `neutral` / `aggravates`) — the model never invents a number.
- **Scores deterministically** — a pure function combines the grades with your
  profile. No randomness, no model in the loop for the number; it's test-pinned
  to a calibration set.
- **Writes the copy** — Gemini phrases the prose, but it can never change a score.

## Tech stack

| Layer | Tech |
| --- | --- |
| Framework | **Next.js 16** (App Router) + **React 19** + **TypeScript** |
| AI | **Google Gemini** via `@google/genai` (label reading, ingredient grading, report copy) |
| Data & auth | **Supabase** (Postgres, Storage, magic-link auth) via `@supabase/ssr` |
| Styling | **CSS Modules** driven by CSS-variable design tokens |
| Hosting | **Vercel** |

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000  (redirects to /onboarding)
```

The app still runs without any keys, but the AI scan and sign-in won't work until you add them. To turn on the full 
app, create a `.env.local`:

```bash
GEMINI_API_KEY=...                 # Google Gemini key
NEXT_PUBLIC_SUPABASE_URL=...        # https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # publishable / anon key
SUPABASE_SERVICE_ROLE_KEY=...       # secret service-role key (server only)
```

Then apply the database schema by running `supabase/schema.sql` in the Supabase
SQL editor.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run the Vitest suite |

## Project structure

```
app/
  api/analyze/        # core pipeline: read label → grade → score → write report
  onboarding/         # build your skin profile
  scan/               # two-photo capture + analyzing state
  report/[id]/        # the results page (private, owner-only)
  share/[token]/      # opt-in public share link
  history/ profile/ settings/
lib/
  gemini.ts           # label read, ingredient grading, report copy
  scoring.ts          # pure, deterministic score
  types.ts            # Zod schemas + inferred types (source of truth)
  ingredients/        # the knowledge base (grade · cache · CosIng · overrides)
components/           # Sidebar, Stepper, ScoreHeader, ResultTabs, …
supabase/schema.sql   # database schema
```

## Disclaimer

SkinIQ is **informational only and not medical advice**. Patch-test new products
and consult a dermatologist for skin concerns.
