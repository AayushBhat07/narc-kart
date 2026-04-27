# Narc Kart - Functionality Test Suite
**QA Agent 2: Functional Verification**
**Date:** 2026-04-25
**Spec Reference:** `../SPEC.md`

---

## 🗺️ Map Tests

### India Boundary
- [ ] India GeoJSON loads and renders correctly
  - GeoJSON file present at `public/india-boundary.geojson`
  - Map displays India outline with green border (#00FF00)
  - Border width is 2px as specified
  - Fill is transparent
  - Hover state: border brightens

### Map Interactions
- [ ] Map pans smoothly in all directions
- [ ] Map zooms smoothly (mouse wheel, pinch, buttons)
- [ ] All seizure markers display at correct lat/long
- [ ] Marker colors match severity:
  - Major (>100kg): `#FF0040` (red)
  - Medium (10-100kg): `#FF6600` (orange)
  - Minor (<10kg): `#FFCC00` (yellow)
  - Border Checkpost: `#00FFFF` (cyan)
  - Sea Port: `#0088FF` (blue)
  - International Border: `#FF00FF` (magenta)
- [ ] Pulsing animation on major seizure markers (>100kg) — 1.5s infinite
- [ ] Click marker → popup appears
- [ ] Popup displays all required fields:
  - Location (city, state)
  - Drug Type
  - Quantity (kg)
  - Date
  - Source link
- [ ] Popup shows drug image if available (from `images` array)
- [ ] Popup has working close button (`X`)
- [ ] Popup styled with: dark background (#0a0a0a), green border glow, "CASE FILE" header
- [ ] Filtered markers update on map in real-time when filters applied
- [ ] Cluster markers expand on zoom (if clustering enabled)

---

## 📱 UI Component Tests

### Header
- [ ] Header displays "NARC KART" title
- [ ] Title uses military stencil style (uppercase, letter-spacing: 0.15em)
- [ ] "CLASSIFIED" badge present
- [ ] Settings icon present
- [ ] Visibility/eye icon present

### Sidebar Navigation
- [ ] Sidebar present with all items:
  - OPS_CENTER (or main nav item)
  - RADAR
  - INTEL
  - NETWORK
  - TERMINAL
- [ ] All nav items clickable/selectable
- [ ] Active state indicator present

### Live Intel Feed
- [ ] Intel feed panel present
- [ ] Feed scrolls automatically
- [ ] New entries appear without manual scroll
- [ ] Entries display with timestamp and content

### Command Input
- [ ] Command input field accepts text
- [ ] Input styled with terminal aesthetic (green text on dark)
- [ ] Enter/submit triggers command processing
- [ ] Cursor blinks (`_` animation)

### Filter Panel
- [ ] Filter panel opens and closes
- [ ] Filter panel includes fields:
  - Time Period
  - Drug Type
  - State
  - Severity
- [ ] All filter dropdowns functional (selectable options)
- [ ] `[EXECUTER]` (Apply) button triggers filter
- [ ] `[CLEAR]` button resets all filters
- [ ] Active filter count badge displays correctly

### Loading Screen
- [ ] Loading screen shows during initial data fetch
- [ ] "NARC KART INITIALIZING" text displayed
- [ ] Blinking cursor visible
- [ ] Progress bar present (green fill on dark)
- [ ] Status messages appear line by line
- [ ] ASCII/code scrolling in background
- [ ] "ESTABLISHING SECURE CONNECTION..." message
- [ ] Version number shown at bottom

### Footer
- [ ] Footer displays current coordinates
- [ ] Coordinates format: `20.5937° N, 78.9625° E` (or live position)
- [ ] UTC timestamp displayed
- [ ] Footer styled with terminal aesthetic

---

## 📐 Responsive Tests

### Desktop (1920px+)
- [ ] Full three-column layout (sidebar | map | intel feed)
- [ ] Header shows all icons
- [ ] Map takes central focus
- [ ] All panels fully visible without collapse

### Tablet (768px–1024px)
- [ ] Sidebar collapses to icon-only mode
- [ ] Expand/collapse toggle works
- [ ] Map remains interactive
- [ ] Intel feed still accessible
- [ ] Filter panel accessible

### Mobile (375px–767px)
- [ ] Stacked layout (header → stat boxes → map → feed)
- [ ] Sidebar hidden or accessible via hamburger menu
- [ ] Map still interactive with touch
- [ ] Popups display correctly on small screen
- [ ] Filter panel opens as modal or bottom sheet
- [ ] Intel feed scrollable

---

## 🔍 Edge Cases

- [ ] Map handles 0 seizure markers gracefully (empty state message)
- [ ] Map handles 1000+ markers without lag (clustering or performance mode)
- [ ] Popup handles missing data fields (no image, no case number)
- [ ] Filter returns 0 results → empty state
- [ ] Network error during data fetch → error state with retry
- [ ] GeoJSON fails to load → fallback or error message
- [ ] Very long location names truncate correctly in popup
- [ ] Marker at identical lat/lon → stacked display

---

## ⚠️ Known Risk Areas

1. **Pulsing animation** — CSS animation may be CPU-intensive on mobile; test battery impact
2. **Marker clustering** — Leaflet.cluster may conflict with custom marker colors; verify colors persist after clustering
3. **Popup positioning** — Popup may render off-screen for markers near edges; test edge cases
4. **GeoJSON boundary** — India boundary must be accurate; verify against known coordinates
5. **Filter state persistence** — Filters should reset on page reload unless intentionally persisted
6. **Intel feed auto-scroll** — May cause performance issues with large log; implement virtual scrolling if needed

---

## 📋 Test Execution Checklist

- [ ] Run on Chrome (latest)
- [ ] Run on Firefox (latest)
- [ ] Run on Safari (latest)
- [ ] Run on Edge (latest)
- [ ] Test with emulated mobile viewport
- [ ] Test with throttled network (3G)
- [ ] Verify no console errors on load
- [ ] Verify no console errors on interactions
