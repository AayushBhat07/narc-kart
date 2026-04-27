# Narc Kart - Accessibility Checklist
**QA Agent 2: Functional Verification**
**Date:** 2026-04-25
**Standard:** WCAG 2.1 AA

---

## ♿ Accessibility Features

### Color & Contrast
- [ ] **Color contrast meets WCAG AA** — minimum 4.5:1 for normal text, 3:1 for large text
- [ ] Text on dark background (black #000000): green text (#00FF00) contrast ratio ≥ 4.5:1
- [ ] Accent colors (red #FF0040, orange #FF6600, yellow #FFCC00) used only for markers, not text
- [ ] No color used as the only means of conveying information (severity also has label/text)
- [ ] Focus indicators visible on all interactive elements
- [ ] Link text distinguishable from surrounding text (underline or color difference)

### Typography & Reading
- [ ] Font size base ≥ 14px
- [ ] Line height ≥ 1.5 for body text
- [ ] Text does not reflow (zoom to 200% without horizontal scroll)
- [ ] No loss of content or functionality at 200% zoom
- [ ] Letter spacing does not cause text overlap at large sizes
- [ ] `prefers-reduced-motion` respected — animations pause or stop

### Keyboard Navigation
- [ ] **Keyboard navigation for all controls** — all interactive elements reachable via Tab
- [ ] Logical tab order (top-to-bottom, left-to-right)
- [ ] No keyboard traps
- [ ] Skip-to-content link for screen readers (hidden but focusable)
- [ ] Nav items navigable via arrow keys
- [ ] Filter panel operable via keyboard (dropdowns, buttons)
- [ ] Modal/popup trap focus when open
- [ ] Escape key closes popup/modal
- [ ] Tab key cycles through popup content correctly

### Screen Reader Support
- [ ] **Screen reader labels on interactive elements** — all buttons/links have descriptive labels
- [ ] `aria-label` on icon-only buttons (settings, close, toggle)
- [ ] `aria-live="polite"` on intel feed (announces new entries)
- [ ] `aria-expanded` on collapsible elements (sidebar, filter panel)
- [ ] `role="dialog"` on seizure detail modal with `aria-modal="true"`
- [ ] Map markers have `aria-label` with seizure summary (e.g., "Major heroin seizure, 150kg, Mumbai")
- [ ] `role="application"` on map with instructions for screen reader users

### Interactive Elements
- [ ] Buttons have discernible text (not just icon)
- [ ] Links have descriptive text (not "click here")
- [ ] Form inputs have associated `<label>` elements
- [ ] Error messages are programmatically associated with inputs
- [ ] Active/selected states visible (not just color change)

### Focus Management
- [ ] **Focus indicators visible** — visible outline or highlight on focused elements
- [ ] Focus not hidden behind other elements
- [ ] Focus moved to modal on open
- [ ] Focus returned to trigger element on modal close

### Images & Media
- [ ] **Alt text for all images**
- [ ] Drug images have descriptive alt text (e.g., "Seized heroin packets in Mumbai case")
- [ ] Decorative images have `alt=""` or are CSS backgrounds
- [ ] Icons have aria-hidden if purely decorative, or aria-label if interactive

---

## 🗺️ Map Accessibility

- [ ] Map has `role="application"` with label "India drug seizure map"
- [ ] Map controls (zoom in/out, pan) keyboard accessible
- [ ] Map markers announced to screen reader on focus
- [ ] Marker popup focusable and closable
- [ ] Legend accessible (even if visually collapsed)
- [ ] Filter results announced ("Showing 45 of 120 seizures")

---

## 📱 Responsive Accessibility

- [ ] Touch targets ≥ 44x44px on mobile
- [ ] No content lost when viewport narrows
- [ ] Modals/adjustable panels don't overlap map content in a way that blocks keyboard users
- [ ] Sidebar hamburger menu keyboard accessible on mobile

---

## 🔍 Testing Tools

### Automated
- [ ] axe DevTools — 0 critical violations, 0 major violations
- [ ] Lighthouse Accessibility score ≥ 90
- [ ] WAVE tool validation

### Manual
- [ ] Tab through entire app — verify all interactions work
- [ ] VoiceOver/NVDA test on map (can user understand marker on focus?)
- [ ] Zoom to 200% — no content loss
- [ ] Test with `prefers-reduced-motion: reduce` — animations stop

---

## 🚨 Critical Accessibility Issues (Must Fix)

- [ ] Any keyboard trap (user cannot exit a component)
- [ ] Missing form labels causing confusion
- [ ] Color contrast failure < 3:1 (large text) or < 4.5:1 (normal text)
- [ ] Interactive elements not keyboard reachable
- [ ] Focus invisible on any interactive element
- [ ] Missing alt text on informational images
- [ ] Modal opens without focus trap

---

## 📋 Accessibility Pre-Launch Checklist

- [ ] Full axe audit — 0 errors
- [ ] Keyboard-only test complete (no mouse)
- [ ] Screen reader test complete (VoiceOver + NVDA)
- [ ] Lighthouse accessibility score ≥ 90
- [ ] Touch targets verified ≥ 44px on all mobile views
- [ ] No loss of functionality at 200% zoom
- [ ] `prefers-reduced-motion` tested
- [ ] All form fields labeled
- [ ] All images have alt text
- [ ] Focus visible on every interactive element
