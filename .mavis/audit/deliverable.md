# Deliverable — Architecture Audit: narc-kart (v2)

## Summary

Performed a thorough architecture audit of the entire narc-kart codebase — 20+ backend Python files, 25+ frontend TypeScript/React files, AND the previously-missed `frontend/api/` Vercel serverless directory. The audit used SPEC.md and UX_ROADMAP.md as architectural contracts/baselines and found **a critical three-way data layer schism**: the SPEC mandates FastAPI + SQLite, but the active deployment uses Vercel Supabase serverless functions (a THIRD data layer not documented in the original audit). The updated report at `.mavis/audit/arch-audit.md` covers 5 Critical, 8 High, 10 Medium, and 10 Low findings with an explicit VERDICT, SPEC conformance table, and verified evidence for every claim.

## Changed Files

- **`/Users/aayush07/Documents/GitHub/narc-kart/.mavis/audit/arch-audit.md`** — Replaced (complete rewrite with VERDICT section, SPEC conformance table, and three-layer data schism analysis)

## Notes

- **Previously missed finding:** `frontend/api/` — Vercel serverless functions using Supabase as the active data layer. This is a third data layer (beyond the two FastAPI stacks), making the schema divergence a three-way schism, not two-way.
- **Correction:** `dompurify` and `framer-motion` ARE in `package.json` — my first audit incorrectly flagged them as missing. The report has been corrected.
- **`@supabase/supabase-js`** is in `package.json` but NOT imported in `frontend/src/` — only in `frontend/api/` (serverless). This is acceptable but latent risk.
- The dual FastAPI backend issue is real but both layers are archived — the active deployment uses Supabase.
- No code was modified during this audit.
