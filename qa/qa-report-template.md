# Narc Kart - QA Report Template
**Project:** Narc Kart | **Date:** [REPORT_DATE] | **Tester:** [NAME]

---

## 1. Screenshot Comparison

### Before/After Screenshots
| Screen | Expected (Stitch) | Actual (Implementation) | Match |
|--------|-------------------|------------------------|-------|
| Main Dashboard | [SCREENSHOT] | [SCREENSHOT] | [] |
| Seizure Detail Modal | [SCREENSHOT] | [SCREENSHOT] | [] |
| Map Legend | [SCREENSHOT] | [SCREENSHOT] | [] |
| Loading Screen | [SCREENSHOT] | [SCREENSHOT] | [] |
| Filter Panel | [SCREENSHOT] | [SCREENSHOT] | [] |

---

## 2. Color Accuracy Checker

### Primary Colors
| Token | Expected Hex | Actual Hex | Delta | Pass/Fail |
|-------|-------------|------------|-------|-----------|
| `--bg-primary` | #000000 | | | [] |
| `--bg-secondary` | #0a0a0a | | | [] |
| `--bg-tertiary` | #111111 | | | [] |
| `--text-primary` | #00FF00 | | | [] |
| `--accent-red` | #FF0040 | | | [] |
| `--accent-orange` | #FF6600 | | | [] |
| `--accent-yellow` | #FFCC00 | | | [] |
| `--accent-cyan` | #00FFFF | | | [] |
| `--accent-blue` | #0088FF | | | [] |
| `--accent-magenta` | #FF00FF | | | [] |

**Color Accuracy Score:** __% (10/10 tokens must match)

### Visual Comparison Notes
[Insert detailed notes on color matching]

---

## 3. Typography Checker

| Element | Expected | Actual | Match |
|---------|----------|--------|-------|
| Primary Font | Share Tech Mono | | [] |
| Font Weight | 400/500 | | [] |
| Header Letter-Spacing | 0.15em | | [] |
| Body Font Size | 14px | | [] |
| Body Line-Height | 1.6 | | [] |
| Header Case | UPPERCASE | | [] |

**Typography Score:** __/6

---

## 4. Layout Deviation Tracker

| Component | Spec Position | Actual Position | Deviation |
|-----------|---------------|-----------------|-----------|
| Header | Fixed top, 60px | | |
| Sidebar | Left, 200-250px | | |
| Map | Center, fills space | | |
| Footer | Bottom, thin strip | | |
| Modal | Centered, max 600px | | |

**Layout Score:** __/5

---

## 5. Component Structure Verification

### Main Dashboard
| Component | Present | Styled Correctly | Notes |
|-----------|---------|------------------|-------|
| CLASSIFIED badge | [] | [] | |
| NARC KART logo | [] | [] | |
| OPS_CENTER sidebar | [] | [] | |
| Stats boxes | [] | [] | |
| India Map | [] | [] | |
| Radar sweep | [] | [] | |
| Intel Feed | [] | [] | |
| Command input | [] | [] | |

**Component Score:** __/8

### Seizure Detail Modal
| Component | Present | Styled Correctly | Notes |
|-----------|---------|------------------|-------|
| CASE FILE header | [] | [] | |
| File number | [] | [] | |
| Drug type | [] | [] | |
| Image container | [] | [] | |
| Quantity (colored) | [] | [] | |
| Date/time | [] | [] | |
| Location/coordinates | [] | [] | |
| Source link | [] | [] | |
| Download button | [] | [] | |
| Close X | [] | [] | |

**Modal Score:** __/10

---

## 6. CRT Effects Verification

| Effect | Present | Correct Implementation | Notes |
|--------|---------|------------------------|-------|
| Scanlines | [] | [] | |
| Text Glow | [] | [] | |
| Border Glow | [] | [] | |
| Vignette | [] | [] | |
| Chromatic Aberration | [] | [] | |

**Effects Score:** __/5

---

## 7. Animation Verification

| Animation | Working | Timing Correct | Notes |
|-----------|---------|----------------|-------|
| Radar Sweep (4s) | [] | [] | |
| Blinking Cursor | [] | [] | |
| Seizure Pulse (1.5s) | [] | [] | |
| Glitch on Hover | [] | [] | |

**Animation Score:** __/4

---

## 8. Issues Found

### Critical Issues (Must Fix)
| # | Issue | Severity | Location | Suggested Fix |
|---|-------|----------|----------|---------------|
| 1 | | CRITICAL | | |
| 2 | | CRITICAL | | |

### Major Issues (Should Fix)
| # | Issue | Severity | Location | Suggested Fix |
|---|-------|----------|----------|---------------|
| 1 | | MAJOR | | |
| 2 | | MAJOR | | |

### Minor Issues (Nice to Fix)
| # | Issue | Severity | Location | Suggested Fix |
|---|-------|----------|----------|---------------|
| 1 | | MINOR | | |
| 2 | | MINOR | | |

---

## 9. Recommendations for Fixes

### Immediate (Before Launch)
1. 
2. 

### Short-term (Post-Launch)
1. 
2. 

### Long-term (Future Versions)
1. 
2. 

---

## 10. Overall QA Score

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Color Accuracy | __/10 | 25% | |
| Typography | __/6 | 15% | |
| Layout | __/5 | 20% | |
| Components | __/18 | 20% | |
| CRT Effects | __/5 | 10% | |
| Animations | __/4 | 10% | |
| **TOTAL** | | 100% | **__%** |

---

## Sign-off

- [ ] Ready for Production
- [ ] Needs Fixes Before Production
- [ ] Major Rewrite Required

**Tester:** _________________ **Date:** _________________

---

*Template Version: 1.0 | For Narc Kart Project*