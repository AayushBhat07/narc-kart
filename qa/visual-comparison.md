# Narc Kart - Visual Comparison Report
**QA Agent 2: Functional Verification**
**Date:** 2026-04-25
**Status:** ⚠️ Stitch images are hosted URLs; direct visual comparison requires screenshot captures from running implementation. This report documents expected design elements and flags areas for visual QA once frontend is running.

---

## 📸 Stitch Design Assets

| Screen | Image URL | HTML URL |
|--------|-----------|----------|
| 1. Main Dashboard | (link in designs file) | (link in designs file) |
| 2. Seizure Detail Modal | (link in designs file) | (link in designs file) |
| 3. Map Legend | (link in designs file) | (link in designs file) |
| 4. Loading Screen | (link in designs file) | (link in designs file) |
| 5. Filter Panel | (link in designs file) | (link in designs file) |

> **Note:** To perform true visual comparison, the frontend must be running. Once deployed, use browser screenshot tool to capture each screen and compare against Stitch images. Update this document with findings.

---

## 🔍 Design-to-Spec Mapping

### 1. Main Dashboard

| Element | Expected (from SPEC.md) | Stitch Design | Status |
|---------|-------------------------|---------------|--------|
| Background | Pure black (#000000) | TBD from screenshot | ⏳ |
| Header title | "NARC KART V1.0", stencil font, green glow | TBD | ⏳ |
| CLASSIFIED badge | Red badge, watermark style | TBD | ⏳ |
| Settings icon | ⚙️ gear icon | TBD | ⏳ |
| Eye icon | 👁️ visibility toggle | TBD | ⏳ |
| Three-column layout | Sidebar \| Map \| Intel Feed | TBD | ⏳ |
| Sidebar items | OPS_CENTER, RADAR, INTEL, NETWORK, TERMINAL | TBD | ⏳ |
| Stat boxes | Total, Active, Threat counts | TBD | ⏳ |
| Map area | India map with markers | TBD | ⏳ |
| Radar sweep | CSS animation, 4s rotation | TBD | ⏳ |
| Live intel feed | Scrolling feed panel | TBD | ⏳ |
| Command input | Terminal-style input field | TBD | ⏳ |
| Footer | Coordinates + UTC timestamp | TBD | ⏳ |
| CRT scanlines | Repeating gradient overlay | TBD | ⏳ |

### 2. Seizure Detail Modal

| Element | Expected (from SPEC.md) | Stitch Design | Status |
|---------|-------------------------|---------------|--------|
| Background | Dark (#0a0a0a) with green border glow | TBD | ⏳ |
| Header | "CASE FILE" in stencil font | TBD | ⏳ |
| CLASSIFIED stamp | Red watermark stamp | TBD | ⏳ |
| Drug type label | Label + icon | TBD | ⏳ |
| Seizure image | Drug photo if available | TBD | ⏳ |
| Quantity display | kg with severity color | TBD | ⏳ |
| Date/time | Timestamp | TBD | ⏳ |
| Location | City, state, coordinates | TBD | ⏳ |
| Source link | Link to original article | TBD | ⏳ |
| Close button | X styled as terminal command | TBD | ⏳ |

### 3. Map Legend

| Element | Expected (from SPEC.md) | Stitch Design | Status |
|---------|-------------------------|---------------|--------|
| Position | Bottom-left or collapsible | TBD | ⏳ |
| Severity icons | Color-coded with labels | TBD | ⏳ |
| Severity scale | Red/Orange/Yellow gradient | TBD | ⏳ |
| Scale bar | Distance indicator | TBD | ⏳ |

### 4. Loading Screen

| Element | Expected (from SPEC.md) | Stitch Design | Status |
|---------|-------------------------|---------------|--------|
| Blinking cursor | `_` animation top-left | TBD | ⏳ |
| Title text | "NARC KART INITIALIZING" | TBD | ⏳ |
| ASCII background | Scrolling code | TBD | ⏳ |
| Progress bar | Green fill on dark track | TBD | ⏳ |
| Status messages | Line-by-line appearing | TBD | ⏳ |
| Connection text | "ESTABLISHING SECURE CONNECTION..." | TBD | ⏳ |
| Version | Bottom of screen | TBD | ⏳ |

### 5. Filter Panel

| Element | Expected (from SPEC.md) | Stitch Design | Status |
|--------|-------------------------|---------------|--------|
| Position | Right sidebar or modal | TBD | ⏳ |
| Time Period | Dropdown field | TBD | ⏳ |
| Drug Type | Dropdown field | TBD | ⏳ |
| State | Dropdown field | TBD | ⏳ |
| Severity | Dropdown field | TBD | ⏳ |
| Apply button | "[EXECUTER]" styled | TBD | ⏳ |
| Clear button | "[CLEAR]" styled | TBD | ⏳ |
| Active filter badge | Count indicator | TBD | ⏳ |
| Terminal aesthetic | Green text on dark | TBD | ⏳ |

---

## 🎨 Visual Elements to Verify

### Color Palette
- [ ] Background: `#000000` (not dark gray, not off-black)
- [ ] Text: `#00FF00` with glow (`text-shadow`)
- [ ] Red marker: `#FF0040`
- [ ] Orange marker: `#FF6600`
- [ ] Yellow marker: `#FF6600`
- [ ] Cyan marker: `#00FFFF`
- [ ] Border glow: `rgba(0, 255, 0, 0.25)` (40% opacity)

### Typography
- [ ] Font family: `Share Tech Mono`, fallback to `Courier New`, monospace
- [ ] Headers: uppercase, `letter-spacing: 0.15em`
- [ ] No font rendering issues (blurry text, wrong fallback)

### Effects
- [ ] CRT scanlines visible (repeating gradient, subtle)
- [ ] Radar sweep animation smooth (4s per rotation)
- [ ] Blinking cursor animation smooth (1s blink interval)
- [ ] Glitch effect on hover (header)
- [ ] Pulsing markers (major seizures only)

### Spacing & Layout
- [ ] Consistent padding (16px standard)
- [ ] Consistent gap (8px between elements)
- [ ] Header height appropriate
- [ ] Map takes maximum available space
- [ ] Sidebar width ~200px on desktop

---

## 🚨 Priority Fixes List

### Critical (Must Match)
1. **Color palette exact match** — any deviation breaks the "military intelligence" aesthetic
2. **CRT scanlines present** — this is a key visual differentiator
3. **Header text glow** — green glow effect essential to design
4. **Map India boundary** — must render correctly, not generic world map

### High (Should Match)
5. **Marker severity colors** — exact hex values per spec
6. **Loading screen progress bar** — green fill on dark
7. **CLASSIFIED stamp watermark** — diagonal red stamp on modals
8. **Pulsing animation** — only on >100kg markers

### Medium (Nice to Match)
9. **Glitch hover effect on header** — adds character, not critical
10. **ASCII scrolling background on loading** — polish detail
11. **Radar sweep overlay** — atmospheric, check performance impact
12. **Font letter-spacing** — 0.15em on headers

### Low (Polish)
13. **Custom scrollbar styling** — green on dark
14. **Selection color** — green highlight
15. **Cursor style** — `crosshair` on map

---

## 📋 Visual QA Process

### Step 1: Run the Frontend
```bash
cd ~/.openclaw/workspace/narc-kart/frontend
npm run dev
```

### Step 2: Capture Screenshots
Use the browser tool to capture:
- Full dashboard (desktop viewport 1920px)
- Dashboard (tablet 768px)
- Dashboard (mobile 375px)
- Loading screen
- Seizure popup (click a marker)
- Filter panel open
- Map legend visible

### Step 3: Compare Against Stitch Designs
Download Stitch images and visually compare:
1. Layout structure match
2. Color exactness
3. Typography fidelity
4. Animation presence/quality
5. Spacing consistency

### Step 4: Document Differences
For each discrepancy found:
1. Screenshot of implementation
2. Screenshot of design
3. Description of difference
4. Severity (Critical/High/Medium/Low)
5. Recommended fix

---

## 📝 Update Log

| Date | QA Agent | Changes |
|------|----------|---------|
| 2026-04-25 | QA Agent 2 | Initial report created. Full visual comparison pending frontend implementation completion. |
