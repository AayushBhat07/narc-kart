import { useEffect, useRef } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import * as THREE from 'three';
import { mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldUrl from 'world-atlas/countries-50m.json?url';
import { Seizure } from '../types';
import styles from './SeizureGlobe.module.css';

/* Black globe drawn with white hairlines: graticule, country borders,
   Indian state borders and (fainter) district borders. Seizures are
   pins; selecting one flies the camera along a great-circle "hop"
   from wherever the camera is to the new city. */

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

const INDIA_VIEW = { lat: 22, lng: 80, altitude: 1.9 };
const LANDING_ALTITUDE = 0.55;

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
  const arcTimerRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
    controls.minDistance = 112;
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
      .pointLat('lat')
      .pointLng('lng')
      .pointRadius(0.13)
      .pointResolution(10)
      .pointsTransitionDuration(0)
      .pointAltitude((d) => {
        const kg = (d as Pin).seizure.quantityKg || 0;
        return 0.004 + Math.min(0.06, Math.log10(kg + 1) * 0.015);
      })
      .pointLabel((d) => {
        const s = (d as Pin).seizure;
        const kg = s.quantityKg >= 1000 ? `${(s.quantityKg / 1000).toFixed(1)} T` : `${(s.quantityKg || 0).toFixed(1)} KG`;
        const wrap = document.createElement('div');
        wrap.className = styles.tooltip;
        wrap.textContent = `${s.location.city.toUpperCase()} · ${s.drugType.toUpperCase()} · ${kg}`;
        return wrap;
      })
      .onPointClick((d) => onSelectRef.current((d as Pin).seizure))
      .onPointHover((d) => { el.style.cursor = d ? 'pointer' : ''; });

    globe
      .ringLat('lat')
      .ringLng('lng')
      .ringMaxRadius(2.2)
      .ringPropagationSpeed(1.6)
      .ringRepeatPeriod(1100);

    globe
      .arcStroke(0.35)
      .arcAltitudeAutoScale(0.35)
      .arcDashLength(0.5)
      .arcDashGap(1.5)
      .arcDashInitialGap(1);

    const resize = () => globe.width(el.clientWidth).height(el.clientHeight);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    return () => {
      cancelled = true;
      ro.disconnect();
      controls.removeEventListener('start', stopIdleSpin);
      if (flightRef.current) cancelAnimationFrame(flightRef.current);
      if (arcTimerRef.current) window.clearTimeout(arcTimerRef.current);
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

  // Pins.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe
      .pointsData(toPins(seizures))
      .pointColor((d) => {
        const s = (d as Pin).seizure;
        return s.id === selected?.id ? '#FFFFFF' : severityColor(s.quantityKg || 0, mode);
      });
  }, [seizures, selected, mode]);

  // Fly to the selected seizure.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    if (!selected) {
      globe.ringsData([]);
      return;
    }

    const ring = PALETTE[mode].ring;
    const target = { lat: selected.location.lat, lng: selected.location.lon };
    globe.ringColor(() => (t: number) => `rgba(${ring},${1 - t})`).ringsData([target]);
    globe.controls().autoRotate = false;

    const start = globe.pointOfView();
    const distance = angularDistanceDeg(start, target);

    if (flightRef.current) cancelAnimationFrame(flightRef.current);
    if (arcTimerRef.current) window.clearTimeout(arcTimerRef.current);

    if (prefersReducedMotion() || distance < 0.01) {
      globe.pointOfView({ ...target, altitude: LANDING_ALTITUDE }, prefersReducedMotion() ? 0 : 600);
      return;
    }

    const duration = Math.min(2600, 1000 + distance * 45);
    const hop = Math.min(1.4, 0.15 + distance / 18);

    // The jump trail: a dashed arc that travels with the camera.
    globe
      .arcColor(() => ['rgba(255,255,255,0.15)', PALETTE[mode].critical])
      .arcDashAnimateTime(duration)
      .arcsData([{ startLat: start.lat, startLng: start.lng, endLat: target.lat, endLng: target.lng }]);
    arcTimerRef.current = window.setTimeout(() => globe.arcsData([]), duration + 1200);

    const a = toVec(start.lat, start.lng);
    const b = toVec(target.lat, target.lng);
    const t0 = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = easeInOut(t);
      const { lat, lng } = fromVec(slerp(a, b, e));
      const altitude = start.altitude + (LANDING_ALTITUDE - start.altitude) * e + hop * Math.sin(Math.PI * e);
      globe.pointOfView({ lat, lng, altitude }, 0);
      flightRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    flightRef.current = requestAnimationFrame(step);
  }, [selected, mode]);

  return <div ref={containerRef} className={styles.globe} aria-label="Interactive globe of seizure locations" />;
}

export default SeizureGlobe;
