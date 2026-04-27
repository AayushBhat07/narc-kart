# Narc Kart - Performance Checklist
**QA Agent 2: Functional Verification**
**Date:** 2026-04-25

---

## 🎯 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial load time (broadband) | < 3s | First Contentful Paint + hydration |
| Map render time | < 1s | Time from GeoJSON loaded to map visible |
| Time to interactive | < 5s | Full dashboard usable |
| Largest Contentful Paint (LCP) | < 2.5s | Largest element visible |
| First Input Delay (FID) | < 100ms | Browser responds to first interaction |
| Cumulative Layout Shift (CLS) | < 0.1 | Visual stability after load |

---

## 🗺️ Map Performance

### GeoJSON Loading
- [ ] India boundary GeoJSON is optimized (< 500KB gzipped)
- [ ] GeoJSON loads asynchronously (non-blocking)
- [ ] Loading state shown while GeoJSON fetches
- [ ] Fallback if GeoJSON fails to load

### Marker Performance
- [ ] Marker clustering enabled for 100+ points
- [ ] Clusters show count badge
- [ ] Clusters expand on zoom (spiderfy or zoom-in)
- [ ] **Marker clustering for 1000+ points** tested
- [ ] Markers use Canvas renderer (via Leaflet) for >100 markers
- [ ] No memory leaks on marker add/remove
- [ ] Popup lazy-instantiation (created on click, not on load)

### Map Tiles
- [ ] Tile layer from free provider (OpenStreetMap or similar)
- [ ] Tiles cached in browser (service worker or HTTP cache)
- [ ] Fallback tiles if primary fails
- [ ] No tile flickering on pan/zoom

---

## 📦 Bundle Size Targets

| Asset | Target Size | Priority |
|-------|-------------|----------|
| Initial JS bundle | < 300KB (gzipped) | Critical |
| CSS | < 50KB (gzipped) | Important |
| Fonts (Share Tech Mono) | < 30KB (gzipped) | Important |
| India GeoJSON | < 500KB (gzipped) | Important |
| Images (static) | < 100KB each | Per-image |
| Map tiles | Cached | N/A |

### Bundle Optimization
- [ ] Code splitting per route (lazy load non-critical components)
- [ ] Tree-shaking enabled (remove unused exports)
- [ ] Minification enabled in production
- [ ] `React.lazy()` for modal/detail components
- [ ] Dynamic import for Leaflet (large library)
- [ ] Font preloading for critical fonts

---

## 🖼️ Image Performance

- [ ] Image lazy loading (`loading="lazy"` on img tags)
- [ ] Image dimensions specified (prevents layout shift)
- [ ] WebP format preferred where supported
- [ ] Image CDN/URLs validated (no mixed content)
- [ ] Drug images resize responsively
- [ ] Fallback placeholder image if drug image 404s
- [ ] Maximum image display size enforced (prevents large images in popup)

---

## 🔄 API & Caching

### API Response Caching
- [ ] Seizure data cached in memory (avoid re-fetch on filter change)
- [ ] Cache invalidation on explicit refresh
- [ ] `localStorage`/`sessionStorage` for offline resilience (optional)
- [ ] HTTP cache headers set (ETag, Cache-Control)

### Data Fetching
- [ ] Initial data fetch shows loading state
- [ ] Optimistic UI updates where appropriate
- [ ] Error state with retry button on API failure
- [ ] Debounced filter queries (300ms delay before API call)
- [ ] Request cancellation on component unmount (AbortController)

---

## ⚡ Runtime Performance

### Rendering
- [ ] No unnecessary re-renders (React.memo on marker/popup components)
- [ ] `useMemo` for derived filter lists
- [ ] `useCallback` for event handlers passed to children
- [ ] Virtualized list for intel feed (if >50 items)
- [ ] CSS animations use `transform` and `opacity` only (GPU-accelerated)

### Animations
- [ ] Radar sweep uses CSS `animation` (not JS interval)
- [ ] Pulsing markers use CSS `animation` (not JS interval)
- [ ] Blinking cursor uses CSS `animation` (not JS interval)
- [ ] `will-change: transform` on animated elements
- [ ] Animations pause when tab is hidden (`prefers-reduced-motion`)

### Memory
- [ ] No memory leaks from setInterval/setTimeout (cleared on unmount)
- [ ] Marker component cleanup on unmount
- [ ] Popup removed from DOM on close
- [ ] Event listener cleanup in useEffect

---

## 📊 Performance Measurement

### Tools to Use
- [ ] Chrome DevTools Performance panel — profile load and interactions
- [ ] Lighthouse CI — automated performance regression testing
- [ ] WebPageTest — real-world multi-browser testing
- [ ] React Developer Tools Profiler — identify re-render issues

### Test Scenarios
- [ ] Cold load on 3G throttling (< 5s acceptable)
- [ ] Warm load from cache (< 1.5s target)
- [ ] Map interaction FPS (target: 60fps, minimum: 30fps)
- [ ] Filter application response time (< 500ms)
- [ ] Popup open time (< 200ms)
- [ ] 1000 markers loaded — no perceptible lag

---

## 🚨 Performance Red Flags (Fix Immediately)

- [ ] Main thread blocking > 50ms
- [ ] Any `layout thrashing` in JavaScript
- [ ] Unthrottled scroll event handlers
- [ ] Large synchronous JavaScript execution
- [ ] Images without dimensions causing CLS spike
- [ ] Network waterfall on initial load
- [ ] JS bundle > 500KB (gzipped)
- [ ] More than 3 render-blocking resources

---

## 📋 Pre-Launch Performance Checklist

- [ ] Run Lighthouse audit — score ≥ 80
- [ ] Run WebPageTest — all metrics in "Good" range
- [ ] Test on low-end device (Android mid-range, ~3GB RAM)
- [ ] Test with CPU throttling (4x slowdown) — app remains usable
- [ ] Verify no memory leaks with DevTools Memory tab (heap snapshots)
- [ ] Confirm bundle size with `npm run build` and analyze
- [ ] Verify Gzip/Brotli compression enabled on server
- [ ] Test on real 4G connection (not just throttled WiFi)
