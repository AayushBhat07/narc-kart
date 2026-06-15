# Narc Kart — PRODUCT.md

> Strategic context for the project. Read alongside DESIGN.md before any
> design / frontend work. The living source for "what this is, who it's for,
> and what we're not."

## Register

**Product** (app UI / dashboard). Design serves the product; the data is
the product; the aesthetic is a frame, not a marketing surface.

The terminal / "Mission Control" frame is *committed brand voice*, not slop —
see Anti-References for the specific aesthetic lanes that would dilute it.

## What it is

A static-deployed intelligence dashboard for publicly available Indian drug
seizure data. Four panels (RADAR / INTEL / NETWORK / TERMINAL) over a Leaflet
map of India, with a live-style feed and a case-file modal per seizure.

Originally a FastAPI + SQLite + Cloudflare-tunnel full-stack app. The current
shipped form is **fully static**: one `drug_seizures_india.json` file
baked in, Vercel-hosted, zero backend, zero CORS pain. README has the history.

## Users

- **Primary**: the developer (you) — it's a portfolio / showpiece for the
  "matrix / military intel" aesthetic. Audience: design-savvy peers on
  social, recruiters, friends.
- **Secondary**: anyone curious about Indian drug seizure data. Public data,
  no auth, no PII. Low stakes, "look at this" energy, not a working tool.

## Context of use

- Mostly desktop, full-screen map, ambient viewing.
- Dark mode only; intended for low-light / "vibes" viewing.
- Short sessions — people scroll, click a marker, read a case file, leave.

## Brand personality

- **Tactical.** Everything is "ops" / "intel" / "case file" / "classified"
  framing. The slang is the brand.
- **Restrained-military, not maximalist-cyberpunk.** Glow, scanlines, and
  radar sweep are committed accents, not wall-to-wall.
- **Functional density.** A lot of info per screen, monospace numerics,
  tabular data, no decorative whitespace.

## What we're not (anti-references)

- **Not** a SaaS dashboard. No KPI hero, no gradient metric cards, no
  purple/blue "productivity tool" palette. If it could be confused with
  Stripe / Linear / Vercel marketing, it's wrong.
- **Not** a "cyberpunk" pastiche. No neon-pink/violet, no chrome bevels,
  no dripping-glitch artwork, no anime-girl mascots. The reference is
  2000s ops-center HUDs (HoloLens, C3, command-line UIs in spy thrillers),
  not Blade Runner.
- **Not** a beige / cream / SaaS "warm minimal" landing page. Pure black.
- **Not** a generic data-vis portal. The data is real and the visual
  language is committed; this is a *thing*, not a template.

## Strategic design principles

1. **Identity preservation beats trend.** The terminal frame is the reason
   this exists. Resist "polishing" it into a generic dashboard.
2. **Function defines the surface.** The map, the case file, the live feed
   are the product. The styling is in service of them.
3. **Restraint inside the frame.** Glow / scanlines / pulse should be
   *intentional accents on the data*, not a default applied to every
   border, label, and icon.
4. **Commit to the monospace, commit to the green.** No half-translations
   to a sans-serif "for accessibility"; instead, the typographic system
   gets done well (numerics align, labels breathe, weights vary).

## Accessibility stance

- Project: dark-only, full-color, monospace, ambient/decorative scanline
  overlay. Real accessibility work lives in:
  - Text contrast (terminal green on black hits WCAG AA for body text; verify).
  - Focus rings (custom but visible, not relying on color alone).
  - Reduced-motion support for scanline / radar / pulse animations.
  - Keyboard navigation through the panel tabs and case-file modal.
- A11y is "in-frame, on-brand", not "neutralized into looking like every
  other site".

## Out of scope

- Light mode.
- Internationalization (data is Indian state names; UI is English).
- Backend, auth, persistence beyond the static JSON.
- Mobile-first redesign (desktop ambient use; mobile is a best-effort
  fallback, not a primary surface).

## What this file is for

When starting any frontend / design work on this repo, read this file
and DESIGN.md. Together they define: register (product), tone (tactical
/ restrained / committed), what's out of scope, and what counts as
on-brand. If a change would push the project into an anti-reference
lane, the change is wrong, not the frame.
