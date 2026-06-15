---
target: frontend/src/App.tsx
total_score: 24
p0_count: 1
p1_count: 2
timestamp: 2026-06-12T18-12-50Z
slug: frontend-src-app-tsx
---
# NARC KART — DESIGN CRITIQUE

## Design Health Score

> First run for this target, no trend yet.

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | No per-operation loading feedback after initial boot |
| 2 | Match System / Real World | 3/4 | Strong tactical language; `narc.operator` feels playful |
| 3 | User Control and Freedom | 2/4 | No Escape to close modal; no undo; dead cmd input bar |
| 4 | Consistency and Standards | 1/4 | Two competing token systems (green-on-black vs white-on-black) |
| 5 | Error Prevention | 2/4 | No confirmations; cmd input accepts any text silently |
| 6 | Recognition Rather Than Recall | 2/4 | Sidebar icons (◎ ◉ ⬡ ★ ▣ ⊞ ▣) are non-communicative |
| 7 | Flexibility and Efficiency | 3/4 | Full terminal CLI with history; cmd bar is broken dead UI |
| 8 | Aesthetic and Minimalist Design | 3/4 | Restrained glow; dot-grid works; glassmorphism in modal |
| 9 | Error Recovery | 3/4 | Terminal errors are sharp; modal close button floats above frame |
| 10 | Help and Documentation | 3/4 | `help` command is comprehensive; no inline hints |
| **Total** | | **24/40** | **Poor — Significant improvements needed** |

---

## Anti-Patterns Verdict

### LLM Assessment: Would someone say "AI made this"?

**No.** The aesthetic is genuinely committed — restrained-military ops-center, not SaaS-cream or cyberpunk pastiche. The terminal CLI is a real feature with depth. The case file modal is the strongest design moment: CLASSIFIED watermark, structured data grid, grayscale evidence photo, DOMPurify sanitization. These feel like intentional craft, not template-filling.

**However**, two issues are dead giveaways of AI-assist or spec drift: the sidebar Unicode icons (◎ ◉ ⬡ ★ ▣ ⊞ ▣) feel randomly assigned rather than from a coherent icon system, and the dual token systems (green-on-black in `design-tokens.css` vs white-on-black in `design-system.css`) suggest two different design directions that were never reconciled.

### Deterministic Scan

```json
{"layout-transition": 4, "contrast": 0, "spacing": 0, "overflow": 0}
```

- 4 × `transition: width/height` warnings (AgencyPanel, ComparePanel, IntelPanel) — legitimate layout-thrashing findings
- No contrast issues detected (white on black, green on black — both pass)
- No spacing or overflow violations detected by static analysis

**Note:** The CLI scanner cannot evaluate runtime contrast of `--text-muted: #008800` on `#000000` background (dark green on pure black may fail 4.5:1 for body text). Browser verification recommended.

---

## Overall Impression

The terminal aesthetic is genuinely compelling — this is not a generic dashboard. The CLI depth, the case file modal, and the restrained use of glow/scanlines show real design intent. The single biggest problem is the **token system collision** that has left the codebase with two incompatible design languages. This is a P0 integrity issue that will produce silent visual bugs. Beyond that, the **dead cmd input bar** is an embarrassing broken affordance that directly contradicts the terminal promise.

**Biggest opportunity:** Commit fully to one token system (green-on-black is the more distinctive brand choice), wire up the cmd input bar to the existing terminal engine, and add Escape key to close the modal.

---

## What's Working

1. **Terminal as genuine CLI, not decoration** — 10 commands with argument validation, history navigation, error messages in-character. The strongest proof of the ops-center commitment.

2. **Case File Modal — authentic peak moment** — CLASSIFIED watermark, CASE FILE label, structured LOCATION/QUANTITY/DATE/AGENCY/SOURCE grid, grayscale evidence photo, DOMPurify sanitization. Creates a real "opening a classified file" sensation.

3. **Severity system is coherent and applied consistently** — Critical/High/Low color scale used uniformly across LiveFeed, SeizurePopup, and StatBoxes. Logical mapping of red→orange→yellow to seizure magnitude.

---

## Priority Issues

### [P0] Token System Collision — Integrity
**What:** Two competing design token files define the same variables with incompatible values:
- `design-tokens.css`: `--text-primary: #00FF00` (terminal green), `--accent-red: #FF0040`
- `design-system.css`: `--text-primary: #FFFFFF` (white), `--accent: #E83D3D` (red)
- `global.css` imports `design-system.css` (white-on-black); `Header.module.css` references `--accent` which exists in design-system but not design-tokens

**Why it matters:** Components resolve different colors for the same token depending on import order. Silent visual bugs will emerge as different components render different foreground colors against the same background.

**Fix:** Delete `design-tokens.css` entirely and migrate any still-used values into `design-system.css`. Or delete `design-system.css` and move all components to use `design-tokens.css` vars. Choose one canonical system.

**Suggested command:** `/impeccable distill` (strip redundant token file) + `/impeccable harden` (verify consistency)

---

### [P1] Dead Global Command Input Bar — Broken Affordance
**What:** The cmd input bar at `App.tsx:76-84` renders an `<input>` with no `onChange`, `onKeyDown`, or any event handler. User types, gets no response.

**Why it matters:** In the radar view (map), the terminal panel is not visible but the cmd bar is. A power user who tries to type a command from the main view gets broken feedback. This directly contradicts the "terminal aesthetic" promise.

**Fix:** Either (a) wire the cmd bar to the existing `TerminalPanel.execute()` engine so it works from any view, or (b) remove it entirely if the terminal panel is the intended command interface. The dead placeholder is worse than the absence.

**Suggested command:** `/impeccable harden` (wire the input to actual handlers)

---

### [P1] Sidebar Iconography is Non-Communicative — Memorization Barrier
**What:** Seven sidebar tabs use Unicode symbols (◎ ◉ ⬡ ★ ▣ ⊞ ▣) with no consistent meaning system. Icons mix geometric shapes with symbolic marks. No tooltips, no text labels alongside icons.

**Why it matters:** Nielsen #6 violation — users must memorize what each icon means. First-time users (Jordan) have no path to understanding without clicking each tab. The icons add visual noise without information value.

**Fix:** Add text labels to sidebar tabs (e.g., "RADAR" "INTEL" "NETWORK" "TERMINAL" "TRENDING" "AGENCY" "COMPARE"). If icons are kept, ensure each maps to a clear semantic category. At minimum, the active tab should have a text label.

**Suggested command:** `/impeccable clarify` (add text labels to sidebar) + `/impeccable layout` (restructure sidebar hierarchy)

---

### [P2] Modal Close Button Floats Outside Frame — Disorienting Exit
**What:** `SeizureModal.module.css` positions close button at `top: -36px` — visually above and outside the modal frame.

**Why it matters:** Creates a jarring exit experience. User's eye must travel from content to a floating button to dismiss. Undermines the peak moment (case file modal) by making the exit feel like an afterthought.

**Fix:** Move close button inside the modal frame at top-right corner. Use `position: absolute; top: 12px; right: 12px` inside the modal content area.

**Suggested command:** `/impeccable layout` (reposition close button)

---

### [P2] StatBoxes Grid Allocates 3 Columns for 2 Items — Wasted Space
**What:** `StatBoxes.module.css` uses `grid-template-columns: repeat(3, 1fr)` but only renders 2 boxes (TOTAL SEIZURES, THIS WEEK'S RAIDS).

**Why it matters:** Empty third column is unforced visual noise in a design system that values minimalist density. Also a layout inconsistency (grid says 3, content says 2).

**Fix:** Change grid to `repeat(2, 1fr)` or add a third stat box if data is available (e.g., TOTAL QUANTITY or ACTIVE STATES).

**Suggested command:** `/impeccable layout` (fix grid columns)

---

### [P3] No Keyboard Accessibility Beyond Terminal
**What:** No Escape key to close SeizureModal. Sidebar tabs are not keyboard-navigable. No skip links. LiveFeed items have no interactive state.

**Why it matters:** Excludes keyboard-only users (Sam persona). Violates WCAG 2.1 baseline. The terminal panel is fully keyboard-accessible; the rest of the UI is not.

**Fix:** Add `useEffect` with Escape key handler in SeizureModal. Make sidebar nav items focusable with `tabIndex`. Add `role="navigation"` and skip link.

**Suggested command:** `/impeccable audit` (full accessibility scan) + `/impeccable harden` (keyboard handlers)

---

### [P3] Terminal `export` is Silent — No Confirmation
**What:** `export` command triggers file download with no confirmation dialog and success string scrolls off screen.

**Why it matters:** User may not realize data was exported, especially if they run other commands afterward. A power user (Alex) who expects explicit confirmation may be unsure the action completed.

**Fix:** Show a blocking-free toast notification or prepend the success message so it doesn't scroll away immediately.

**Suggested command:** `/impeccable clarify` (add confirmations for side-effect commands)

---

## Persona Red Flags

### Alex (Power User)
- Will try the global cmd input bar from radar view → finds it dead → trust broken
- Will try Escape key to close modal → fails → frustrated, must reach for mouse
- Will notice token collision when debugging color values
- Will deeply appreciate the terminal command depth, history navigation, and data export

### Jordan (First-Timer)
- Will not understand sidebar icons without labels or tooltips
- Will not know what to do after closing a case file modal — no next-step cue, disoriented
- Will be genuinely impressed by CLASSIFIED aesthetic and case file modal (peak moment lands)
- Will be confused by having two command interfaces (dead global bar + working terminal panel)

### Sam (Accessibility-Dependent)
- Cannot operate sidebar or modal without a pointing device — no keyboard alternative
- Will find `--text-muted: #008800` (dark green on #000000) likely fails 4.5:1 contrast
- The pulsing red animation in `design-tokens.css` (`@keyframes pulse`) may trigger photosensitivity issues
- Will not have screen reader accessible labels for icon-only buttons

---

## Minor Observations

1. **Blinking cursor** — `blink-cursor` keyframe runs infinitely; `@media (prefers-reduced-motion)` in `design-system.css` handles opt-out but default is animation-on
2. **IndiaMap GeoJSON failure is silent** — `console.warn` on boundary load failure; no user-visible indicator if it fails
3. **LiveFeed `key` prop** — Uses `${seizure.id}-${idx}` which suppresses React reconciliation; `seizure.id` alone should suffice if IDs are stable
4. **SeizureModal backdrop-filter** — `blur(4px)` is the only glassmorphism-adjacent effect; a plain `rgba(0,0,0,0.75)` would be more consistent with the anti-glassmorphism directive
5. **`narc.operator` in terminal** — Feels playful rather than authoritative; consider `classified.operator` or `intel.operator` to stay in character
6. **AgencyPanel / ComparePanel** — These feel like的后续 (follow-on) features; the `⊞` icon for compare is the least intuitive in the set

---

## Questions to Consider

1. **Why does the global cmd input bar exist if it does nothing?** Is it a placeholder for a future feature, or was it built and abandoned mid-implementation?

2. **Should the token system be green-on-black or white-on-black?** The green-on-black in `design-tokens.css` is more distinctive and committed to the ops-center aesthetic. The white-on-black in `design-system.css` is safer and more readable. This is the foundational design decision.

3. **Should the case file modal be the homepage experience?** The peak moment is the modal. Is there an opportunity to guide users to open one immediately on load, or pre-focus a seizure?

4. **Should the sidebar have text labels on all 7 tabs, or should some be hidden for "power user" mode?** The current icon-only approach serves neither Alex (who wants shortcuts) nor Jordan (who needs labels) optimally.

5. **Should the `export` command require confirmation?** It's a side-effect operation (file download) that could be accidentally triggered. A confirmation is low-friction and would prevent confusion.
