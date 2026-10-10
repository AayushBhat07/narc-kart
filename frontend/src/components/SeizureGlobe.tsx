import { useEffect, useRef } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import * as THREE from 'three';
import { mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldUrl from 'world-atlas/countries-50m.json?url';
import { Seizure } from '../types';
import styles from './SeizureGlobe.module.css';
import { createCurtainTrail, type CurtainTrail } from './curtainTrail';

/* Black globe drawn with white hairlines: graticule, country borders,
   Indian state borders and (fainter) district borders. Seizures are
   HUD callouts; selecting one flies the camera along a great-circle "hop"
   to the new city while a hairline curtain trail draws in from the last one. */

interface Props {
  seizures: Seizure[];
  selected: Seizure | null;
  onSelect: (s: Seizure) => void;
  mode?: 'main' | 'rave';
}

interface Pin {
  seizure: Seizure;
  lat: number;
  lng: number;
}

type LngLat = [number, number];

interface Callout {
  el: HTMLElement;
  pin: Pin;
  kg: number;
  selected: boolean;
  width: number;
}

const INDIA_VIEW = { lat: 22, lng: 80, altitude: 1.9 };
const LANDING_ALTITUDE = 0.55;
const MIN_DISTANCE = 112;
/** Mid-flight, the camera tips forward towards the destination (0 = straight down). */
const FLIGHT_TILT = 0.95;
/** ...and flies this far to the side of the trail (fraction of the hop) so it's seen at an angle. */
const FLIGHT_SIDE = 0.6;

const PALETTE = {
  main: { critical: '#E83D3D', high: '#FF7043', low: '#FFB300', ring: '232,61,61' },
  rave: { critical: '#FF1B8D', high: '#00E5FF', low: '#B6FF00', ring: '255,27,141' },
};

function severityColor(kg: number, mode: 'main' | 'rave') {
  const p = PALETTE[mode];
  if (kg > 100) return p.critical;
  if (kg > 10) return p.high;
  return p.low;
}

function formatKg(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}T` : `${kg >= 10 ? Math.round(kg) : kg.toFixed(1)}KG`;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/* ── Geometry helpers ─────────────────────────────────────────── */

function graticule(step = 15): LngLat[][] {
  const lines: LngLat[][] = [];
  for (let lng = -180; lng < 180; lng += step) {
    const line: LngLat[] = [];
    for (let lat = -80; lat <= 80; lat += 2) line.push([lng, lat]);
    lines.push(line);
  }
  for (let lat = -75; lat <= 75; lat += step) {
    const line: LngLat[] = [];
    for (let lng = -180; lng <= 180; lng += 2) line.push([lng, lat]);
    lines.push(line);
  }
  return lines;
}

/** One LineSegments object per layer = one draw call, 1px "hairline" strokes. */
function hairlines(globe: GlobeInstance, lines: LngLat[][], opacity: number, altitude: number) {
  const pos: number[] = [];
  const push = (lng: number, lat: number) => {
    const { x, y, z } = globe.getCoords(lat, lng, altitude);
    pos.push(x, y, z);
  };
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [lng0, lat0] = line[i - 1];
      const [lng1, lat1] = line[i];
      if (Math.abs(lng1 - lng0) > 180) continue; // antimeridian wrap
      push(lng0, lat0);
      push(lng1, lat1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false });
  return new THREE.LineSegments(geometry, material);
}

/** Spread pins that share a city so each one stays clickable. */
function toPins(seizures: Seizure[]): Pin[] {
  const seen = new Map<string, number>();
  return seizures
    .filter((s) => Number.isFinite(s.location.lat) && Number.isFinite(s.location.lon))
    .map((s) => {
      const key = `${s.location.lat.toFixed(3)},${s.location.lon.toFixed(3)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      if (n === 0) return { seizure: s, lat: s.location.lat, lng: s.location.lon };
      const angle = n * 2.39996; // golden angle spiral
      const r = 0.09 * Math.sqrt(n);
      return { seizure: s, lat: s.location.lat + r * Math.sin(angle), lng: s.location.lon + r * Math.cos(angle) };
    });
}

const FAN_GAP = 16; // px between markers fanned out from one spot

/** Two passes, run whenever the camera moves:
    1. Markers that land within a few pixels of each other on screen (same
       city, or neighbouring cities when zoomed out) fan out in a small ring
       and get nudged apart, so every one of them stays clickable.
    2. Labels are packed so none overlap: the selected seizure first, then
       the heaviest. */
function declutter(globe: GlobeInstance, callouts: Callout[]) {
  const visible = callouts
    .filter((c) => c.el.style.display !== 'none')
    .sort((a, b) => Number(b.selected) - Number(a.selected) || b.kg - a.kg);

  const clusters: { x: number; y: number; members: Callout[] }[] = [];
  const anchor = new Map<Callout, { x: number; y: number }>();
  const pos = new Map<Callout, { x: number; y: number }>();
  for (const c of visible) {
    const p = globe.getScreenCoords(c.pin.lat, c.pin.lng, 0.002);
    anchor.set(c, p);
    const near = clusters.find((k) => Math.hypot(k.x - p.x, k.y - p.y) < FAN_GAP - 4);
    if (near) near.members.push(c);
    else clusters.push({ ...p, members: [c] });
  }
  for (const k of clusters) {
    const n = k.members.length;
    const r = n > 1 ? Math.max(FAN_GAP * 0.75, (FAN_GAP * n) / (2 * Math.PI)) : 0;
    k.members.forEach((c, i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2;
      pos.set(c, { x: k.x + r * Math.cos(a), y: k.y + r * Math.sin(a) });
    });
  }
  // A ring can still land on a neighbouring city's marker: nudge any pair
  // that's too close apart until each square has its own spot.
  const pts = [...pos.values()];
  for (let iter = 0; iter < 8; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= FAN_GAP - 2) continue;
        const push = (FAN_GAP - d) / 2;
        const ux = d > 0.01 ? dx / d : 1;
        const uy = d > 0.01 ? dy / d : 0;
        pts[i].x -= ux * push; pts[i].y -= uy * push;
        pts[j].x += ux * push; pts[j].y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const [c, p] of pos) {
    const a = anchor.get(c)!;
    const dx = Math.round(p.x - a.x);
    const dy = Math.round(p.y - a.y);
    c.el.style.translate = dx || dy ? `${dx}px ${dy}px` : '';
  }

  // Boxes are obstacles too, so a label never hides another marker.
  const taken = [...pos.values()].map(({ x, y }) => ({ x0: x - 6, y0: y - 6, x1: x + 6, y1: y + 6 }));
  const shown = new Set<Callout>();
  for (const c of visible) {
    if (!c.selected && c.kg <= 10) continue;
    const { x, y } = pos.get(c)!;
    const box = { x0: x + 20, y0: y - 26, x1: x + 26 + c.width, y1: y - 10 };
    if (!c.selected && taken.some((t) => box.x0 < t.x1 && box.x1 > t.x0 && box.y0 < t.y1 && box.y1 > t.y0)) continue;
    taken.push(box);
    shown.add(c);
  }
  for (const c of callouts) {
    if (shown.has(c)) c.el.dataset.callout = '';
    else delete c.el.dataset.callout;
  }
}

/* ── Fly-to: great-circle path with an altitude hop ───────────── */

function toVec(lat: number, lng: number) {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
}

function fromVec([x, y, z]: number[]) {
  return { lat: (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI, lng: (Math.atan2(y, x) * 180) / Math.PI };
}

function slerp(a: number[], b: number[], t: number) {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const ω = Math.acos(dot);
  if (ω < 1e-6) return b;
  const s = Math.sin(ω);
  const ka = Math.sin((1 - t) * ω) / s;
  const kb = Math.sin(t * ω) / s;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}

const cross = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];

function normalize(u: number[]) {
  const l = Math.hypot(u[0], u[1], u[2]) || 1;
  return [u[0] / l, u[1] / l, u[2] / l];
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function angularDistanceDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const va = toVec(a.lat, a.lng);
  const vb = toVec(b.lat, b.lng);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  return (Math.acos(dot) * 180) / Math.PI;
}

/* ── Component ────────────────────────────────────────────────── */

export function SeizureGlobe({ seizures, selected, onSelect, mode = 'main' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const flightRef = useRef<number | null>(null);
  const trailTimerRef = useRef<number | null>(null);
  const trailRef = useRef<CurtainTrail | null>(null);
  const lastStopRef = useRef<{ lat: number; lng: number } | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const calloutsRef = useRef<Callout[]>([]);
  const declutterRef = useRef<() => void>(() => {});

  // Create the globe once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const globe = new Globe(el, { animateIn: false })
      .backgroundColor('rgba(0,0,0,0)')
      .showGlobe(true)
      .showGraticules(false)
      .showAtmosphere(true)
      .atmosphereColor('#ffffff')
      .atmosphereAltitude(0.06)
      .globeMaterial(new THREE.MeshBasicMaterial({ color: 0x000000 }))
      .pointOfView(INDIA_VIEW, 0);
    globeRef.current = globe;

    const controls = globe.controls();
    controls.autoRotate = !prefersReducedMotion();
    controls.autoRotateSpeed = 0.3;
    controls.enableDamping = true;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = 650;
    const stopIdleSpin = () => { controls.autoRotate = false; };
    controls.addEventListener('start', stopIdleSpin);

    const scene = globe.scene();
    const layers: THREE.LineSegments[] = [];
    const addLayer = (lines: LngLat[][], opacity: number, altitude: number) => {
      const layer = hairlines(globe, lines, opacity, altitude);
      layers.push(layer);
      scene.add(layer);
    };

    addLayer(graticule(), 0.16, 0.0005);

    let cancelled = false;
    fetch(worldUrl)
      .then((r) => r.json())
      .then((world: Topology) => {
        if (cancelled) return;
        const borders = mesh(world, world.objects.countries as GeometryCollection);
        addLayer(borders.coordinates as LngLat[][], 0.85, 0.001);
      })
      .catch((err) => console.warn('[globe] world borders failed to load', err));

    fetch(`${import.meta.env.BASE_URL}india-districts.topojson`)
      .then((r) => r.json())
      .then((india: Topology) => {
        if (cancelled) return;
        const obj = india.objects['india-districts'] as GeometryCollection;
        const stateOf = (g: { properties?: unknown }) => (g.properties as { NAME_1?: string } | undefined)?.NAME_1;
        const states = mesh(india, obj, (a, b) => a !== b && stateOf(a) !== stateOf(b));
        const districts = mesh(india, obj, (a, b) => a !== b && stateOf(a) === stateOf(b));
        addLayer(districts.coordinates as LngLat[][], 0.14, 0.001);
        addLayer(states.coordinates as LngLat[][], 0.55, 0.0012);
      })
      .catch((err) => console.warn('[globe] India borders failed to load', err));

    globe
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude(0.002)
      .htmlTransitionDuration(0)
      .htmlElementVisibilityModifier((node, visible) => {
        node.style.display = visible ? '' : 'none';
      });

    // Re-pack labels as the camera moves, at most once per frame.
    let declutterFrame = 0;
    const scheduleDeclutter = () => {
      if (declutterFrame) return;
      declutterFrame = requestAnimationFrame(() => {
        declutterFrame = 0;
        declutter(globe, calloutsRef.current);
      });
    };
    declutterRef.current = scheduleDeclutter;
    controls.addEventListener('change', scheduleDeclutter);

    globe
      .ringLat('lat')
      .ringLng('lng')
      .ringMaxRadius(2.2)
      .ringPropagationSpeed(1.6)
      .ringRepeatPeriod(1100);

    const resize = () => {
      globe.width(el.clientWidth).height(el.clientHeight);
      scheduleDeclutter();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    return () => {
      cancelled = true;
      ro.disconnect();
      controls.removeEventListener('start', stopIdleSpin);
      controls.removeEventListener('change', scheduleDeclutter);
      cancelAnimationFrame(declutterFrame);
      if (flightRef.current) cancelAnimationFrame(flightRef.current);
      if (trailTimerRef.current) window.clearTimeout(trailTimerRef.current);
      trailRef.current?.dispose();
      trailRef.current = null;
      layers.forEach((l) => {
        scene.remove(l);
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });
      globe._destructor();
      el.innerHTML = '';
      globeRef.current = null;
    };
  }, []);

  // HUD callouts: a small square per seizure; seizures over 10 kg (and the
  // selected one) get a leader line and label wherever there's room.
  // Only the square takes clicks, so a label never blocks a marker under it.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const callouts: Callout[] = [];

    globe.htmlElementsData(toPins(seizures)).htmlElement((d) => {
      const pin = d as Pin;
      const s = pin.seizure;
      const kg = s.quantityKg || 0;
      const isSelected = s.id === selected?.id;
      const text = `${s.location.city.toUpperCase()} ${formatKg(kg)}`;

      const el = document.createElement('div');
      el.className = styles.marker;
      el.style.setProperty('--c', isSelected ? '#FFFFFF' : severityColor(kg, mode));
      if (kg > 10) el.dataset.filled = '';
      if (isSelected) el.dataset.selected = '';
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${s.location.city}, ${s.drugType}, ${formatKg(kg)}`);
      el.innerHTML =
        `<span class="${styles.box}"></span>` +
        `<svg class="${styles.leader}" width="22" height="22" aria-hidden="true"><path d="M0 22 L12 6 L22 6"/></svg>` +
        `<span class="${styles.label}"></span>`;
      const label = el.querySelector(`.${styles.label}`)!;
      label.textContent = `${s.location.city.toUpperCase()} `;
      const qty = document.createElement('b');
      qty.textContent = formatKg(kg);
      label.appendChild(qty);

      const choose = () => onSelectRef.current(s);
      el.addEventListener('click', choose);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
      });

      // ~7px per mono glyph at 10px with 0.08em tracking, plus padding.
      callouts.push({ el, pin, kg, selected: isSelected, width: text.length * 7.2 + 14 });
      return el;
    });

    calloutsRef.current = callouts;
    declutterRef.current();
  }, [seizures, selected, mode]);

  // Fly to the selected seizure: a great-circle hop with the camera tipped
  // forward and off to one side, drawing the curtain trail as it goes.
  useEffect(() => {
    const globe = globeRef.current;
    const el = containerRef.current;
    if (!globe || !el) return;
    const controls = globe.controls();

    const endFlight = () => {
      if (flightRef.current) cancelAnimationFrame(flightRef.current);
      flightRef.current = null;
      if (!globeRef.current) return; // unmounting: the globe is already gone
      controls.target.set(0, 0, 0);
      controls.minDistance = MIN_DISTANCE;
      controls.update();
      delete el.dataset.flying;
    };

    if (!selected) {
      globe.ringsData([]);
      return;
    }

    const ring = PALETTE[mode].ring;
    const target = { lat: selected.location.lat, lng: selected.location.lon };
    globe.ringColor(() => (t: number) => `rgba(${ring},${1 - t})`).ringsData([target]);
    controls.autoRotate = false;

    endFlight();
    if (trailTimerRef.current) window.clearTimeout(trailTimerRef.current);
    trailRef.current?.dispose();
    trailRef.current = null;

    const start = globe.pointOfView();
    const from = lastStopRef.current ?? start;
    lastStopRef.current = target;
    const distance = angularDistanceDeg(start, target);

    if (prefersReducedMotion() || distance < 0.01) {
      globe.pointOfView({ ...target, altitude: LANDING_ALTITUDE }, prefersReducedMotion() ? 0 : 600);
      return;
    }

    const duration = Math.min(2600, 1000 + distance * 45);
    const hop = Math.min(0.25, 0.08 + distance / 45);

    const trail = createCurtainTrail(globe, from, target);
    trailRef.current = trail;
    trailTimerRef.current = window.setTimeout(() => {
      const f0 = performance.now();
      const fadeOut = (now: number) => {
        if (trailRef.current !== trail) return;
        const f = 1 - (now - f0) / 900;
        if (f <= 0) {
          trail.dispose();
          trailRef.current = null;
          return;
        }
        trail.fade(f);
        requestAnimationFrame(fadeOut);
      };
      requestAnimationFrame(fadeOut);
    }, duration + 1400);

    // The trail is drawn from the last seizure; the camera flies from wherever it is.
    const trailLength = angularDistanceDeg(from, target);
    const a = toVec(start.lat, start.lng);
    const b = toVec(target.lat, target.lng);
    const side = normalize(cross(a, b));
    const sideAmount = FLIGHT_SIDE * Math.min(0.35, (distance * Math.PI) / 180);
    const ground = globe.getCoords(target.lat, target.lng, 0);
    const t0 = performance.now();

    el.dataset.flying = '';
    controls.minDistance = 0; // the look-at target sits near the surface mid-flight

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = easeInOut(t);
      const p = slerp(a, b, e);
      const k = sideAmount * Math.sin(Math.PI * e);
      const { lat, lng } = fromVec(normalize([p[0] + side[0] * k, p[1] + side[1] * k, p[2] + side[2] * k]));
      const altitude = start.altitude + (LANDING_ALTITUDE - start.altitude) * e + hop * Math.sin(Math.PI * e);
      globe.pointOfView({ lat, lng, altitude }, 0);

      // Look towards the destination. Once the camera is above it, that's the
      // same view as looking at the centre, so landing needs no snap.
      const w = FLIGHT_TILT * Math.min(1, e * 2.2);
      controls.target.set(ground.x * w, ground.y * w, ground.z * w);
      controls.update();

      trail.reveal(trailLength > 0.01 ? e : 1);
      declutterRef.current();
      if (t < 1) flightRef.current = requestAnimationFrame(step);
      else endFlight();
    };
    flightRef.current = requestAnimationFrame(step);

    return endFlight;
  }, [selected, mode]);

  return <div ref={containerRef} className={styles.globe} aria-label="Interactive globe of seizure locations" />;
}

export default SeizureGlobe;
