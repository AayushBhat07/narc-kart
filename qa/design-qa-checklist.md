# Narc Kart - Design QA Checklist
**Version:** 1.0 | **Date:** 2026-04-25 | **Agent:** Design QA Agent 1 (Visual Match)

---

## Overview
This checklist verifies that the Narc Kart frontend implementation matches the SPEC.md design specification and the Stitch-generated designs.

---

## 1. Color Palette Verification

### Must Match SPEC.md Tokens
| Token | Spec Hex | Implementation | Status |
|-------|----------|----------------|--------|
| `--bg-primary` | `#000000` | | [] |
| `--bg-secondary` | `#0a0a0a` | | [] |
| `--bg-tertiary` | `#111111` | | [] |
| `--text-primary` | `#00FF00` | | [] |
| `--text-secondary` | `#00CC00` | | [] |
| `--text-muted` | `#008800` | | [] |
| `--accent-red` | `#FF0040` | | [] |
| `--accent-orange` | `#FF6600` | | [] |
| `--accent-yellow` | `#FFCC00` | | [] |
| `--accent-cyan` | `#00FFFF` | | [] |
| `--accent-blue` | `#0088FF` | | [] |
| `--accent-magenta` | `#FF00FF` | | [] |
| `--border-glow` | `#00FF0040` | | [] |

### Stitch Design Observations
- **Main Dashboard:** Background `#050805` (dark charcoal), Primary Green `#00FF41`, Secondary `#1A2B1A`
- **Seizure Modal:** Primary Green `#00FF41`, Border `#004D00`, Warning Red `#800000`
- **Map Legend:** Background `#050505`, Primary Green `#A2FF86`, Alert Red `#FF4D4D`
- **Loading Screen:** Background `#050805`, Primary Green `#00FF41`, Mid Green `#006622`
- **Filter Panel:** Background `#0B0B0B`, Primary Green `#00FF41`, Muted `#004D13`

**Note:** Stitch uses `#00FF41` (slightly brighter) vs SPEC `#00FF00`. **This is a deviation** — implementation must use SPEC value.

---

## 2. Typography Verification

| Requirement | Spec | Implementation | Status |
|-------------|------|----------------|--------|
| Font Family | `Share Tech Mono`, Courier New, monospace | | [] |
| Font Source | Google Fonts | | [] |
| Headers | Uppercase, letter-spacing: 0.15em | | [] |
| Body Size | 14px base, line-height 1.6 | | [] |
| Data Numbers | Tabular/monospace | | [] |

### Stitch Design Observations
- Stitch uses monospaced fonts (likely JetBrains Mono or Roboto Mono variant)
- All text in Stitch designs is uppercase
- Letter spacing varies slightly from SPEC (SPEC: 0.15em)

---

## 3. CRT Effects Checklist

| Effect | Spec Implementation | Status |
|--------|---------------------|--------|
| Scanlines | CSS pseudo-element, repeating gradient overlay | [] |
| Text Glow | `text-shadow: 0 0 10px var(--text-primary)` | [] |
| Border Glow | `box-shadow: 0 0 20px var(--border-glow)` | [] |
| Vignette | Subtle corner darkening | [] |
| Chromatic Aberration | Slight RGB fringing on edges | [] |

### Stitch Design Observations
- Scanlines: Present in all 5 designs
- Glow/Bloom: Present on green and alert elements
- Vignette: Present on main dashboard and modal
- Chromatic Aberration: Present on seizure modal image

---

## 4. "CLASSIFIED" Watermark

| Requirement | Status |
|-------------|--------|
| Large diagonal text | [] |
| 5% opacity | [] |
| Present on main dashboard | [] |
| Present on seizure modal | [] |
| Red color (#FF0040 or similar) | [] |

### Stitch Design Observations
- Main Dashboard: CLASSIFIED badge top-right, visible
- Seizure Modal: CONFIDENTIAL background stamp, diagonal, semi-transparent red

---

## 5. Layout Proportions

| Component | Spec | Status |
|-----------|------|--------|
| Header Height | Fixed, ~60px | [] |
| Sidebar Width | ~200-250px | [] |
| Map Area | Central, dominant | [] |
| Footer | Thin strip with coordinates | [] |
| Modal Width | Max 600px, centered | [] |
| Modal Border Radius | Slight curve (CRT effect) | [] |

---

## 6. Main Dashboard Components

| Component | Status |
|-----------|--------|
| Header: NARC KART V1.0 logo | [] |
| Header: CLASSIFIED badge | [] |
| Header: Settings icon | [] |
| Header: User/viewer icon | [] |
| Sidebar: OPS_CENTER navigation | [] |
| Sidebar: RADAR, INTEL, NETWORK, TERMINAL items | [] |
| Stats boxes: Total, Active, Threat | [] |
| India Map with markers | [] |
| Radar sweep animation | [] |
| Live Intel Feed (right sidebar) | [] |
| Command input field | [] |
| Footer: Coordinates + UTC time | [] |

---

## 7. Seizure Detail Modal Components

| Component | Status |
|-----------|--------|
| Dark panel with green border glow | [] |
| CASE FILE header + file number | [] |
| Drug type label + icon | [] |
| Seizure image container | [] |
| Quantity in kg with severity color | [] |
| Date + time display | [] |
| Location with coordinates | [] |
| Source link | [] |
| DOWNLOAD_EVIDENCE_PACK button | [] |
| Close X button | [] |
| WARNING_ACCESS_NOTICE box | [] |

---

## 8. Map Legend Components

| Component | Status |
|-----------|--------|
| Semi-transparent container | [] |
| Green border with corner brackets | [] |
| Major Seizure marker (>500kg) | [] |
| Medium Seizure marker (50-499kg) | [] |
| Minor Seizure marker (<15kg) | [] |
| Border Checkpost marker (cyan square) | [] |
| Sea Port marker (blue anchor/diamond) | [] |
| International Border line (magenta dashed) | [] |
| SYS_VER version number | [] |
| SEC_LVL classification | [] |

---

## 9. Loading Screen Components

| Component | Status |
|-----------|--------|
| Full black background (#000000) | [] |
| Blinking cursor (top-left area) | [] |
| "NARC KART INITIALIZING" title | [] |
| ASCII/terminal style status lines | [] |
| Progress bar with green fill | [] |
| Percentage inside bar | [] |
| Status messages: CHECKMARK list | [] |
| "ESTABLISHING SECURE CONNECTION..." | [] |
| Version number bottom | [] |
| Coordinates in corners | [] |

---

## 10. Filter Panel Components

| Component | Status |
|-----------|--------|
| Dark panel (#0a0a0a) | [] |
| Time Period dropdown | [] |
| Drug Type dropdown | [] |
| State dropdown | [] |
| Severity dropdown | [] |
| Monospace input styling | [] |
| Green outline on inputs | [] |
| [EXECUTER] button (solid green) | [] |
| [CLEAR] button (outline) | [] |
| Active filter count badge | [] |

---

## 11. Animation Verification

| Animation | Spec | Status |
|-----------|------|--------|
| Radar Sweep | 4s rotation, CSS animation | [] |
| Blinking Cursor | Opacity animation, hollow block or underscore | [] |
| Major Seizure Pulse | 1.5s infinite, red glow | [] |
| Glitch Effect | CSS clip-path on header hover | [] |

---

## 12. Map Implementation

| Requirement | Status |
|-------------|--------|
| India GeoJSON loaded | [] |
| Leaflet CRS.Simple or Mercator | [] |
| Transparent fill, solid green border (#00FF00) | [] |
| Border width 2px | [] |
| Hover highlight state | [] |
| Major seizure markers: red (#FF0040), 16px, pulsing | [] |
| Medium seizure markers: orange (#FF6600), 12px | [] |
| Minor seizure markers: yellow (#FFCC00), 8px | [] |
| Border checkpost: cyan (#00FFFF), 10px square | [] |
| Sea port: blue (#0088FF), 10px diamond | [] |
| International border: magenta (#FF00FF), 10px triangle | [] |

---

## Summary

**Total Checks:** 12 categories
**Passed:** 
**Failed:** 
**Deviations Found:** 

---

## Critical Deviations Requiring Fix

1. **[HIGH]** Color mismatch: Stitch uses `#00FF41`, SPEC uses `#00FF00` — must use SPEC
2. **[MEDIUM]** Font: Must be Share Tech Mono specifically from Google Fonts
3. **[MEDIUM]** All text must be uppercase with letter-spacing: 0.15em for headers

---

*Last Updated: 2026-04-25*