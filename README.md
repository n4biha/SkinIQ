# SkinIQ

Personalized skincare ingredient analysis. Create a skin profile, photograph a
product's ingredient list, and get a deterministic, rules-based **match score**
and breakdown tailored to your skin type and concerns.

> **Status:** Phase A in progress — app shell, design system, and navigation are
> built. Screen content, the Gemini analysis pipeline, scoring engine, and
> Supabase persistence land in later slices.

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **CSS Modules** driven by CSS-variable design tokens (no Tailwind)
- **Inter** via `next/font/google`
- Planned: **Gemini 2.5 Flash** (`@google/genai`) for label reading, **Zod** for
  validation, a deterministic **scoring** engine, and **Supabase** for auth/db/storage

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000> — it redirects to `/onboarding`.

No API keys or accounts are required yet. When the analysis pipeline lands you'll
add `GEMINI_API_KEY`; Supabase keys come with persistence.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint with ESLint |

## Project structure

```
app/
  layout.tsx            # shell: sidebar + main, loads Inter + design tokens
  globals.css           # CSS variables (design tokens) + base styles
  page.tsx              # redirects to /onboarding
  onboarding/           # step 1 — skin profile
  scan/                 # step 2 — upload (+ step 3 analyzing state)
  report/[id]/          # step 4 — results
  history/  profile/  settings/
components/
  Sidebar.tsx           # left nav (Scan Product · History · Profile · Settings)
  Stepper.tsx           # 4-step progress indicator
```

## Disclaimer

SkinIQ is informational only and not medical advice. Patch-test new products and
consult a dermatologist for skin concerns.
