import * as THREE from 'three';
import type { GlobeInstance } from 'globe.gl';

/* The jump trail between two seizures, drawn only in white hairlines:
   a ground track, an arc lifting off the globe, and vertical drop lines
   from the arc to the ground, so the path reads as a see-through fence. */

type LatLng = { lat: number; lng: number };

const SAMPLES = 128;
const DROP_EVERY = 3;

function toVec(lat: number, lng: number) {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
}

function fromVec([x, y, z]: number[]): LatLng {
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

function hairline(points: THREE.Vector3[], opacity: number, segments = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false });
  const line = segments ? new THREE.LineSegments(geometry, material) : new THREE.Line(geometry, material);
  line.userData.opacity = opacity;
  return line;
}

export interface CurtainTrail {
  /** Reveal the trail from the start up to e (0 → 1). */
  reveal(e: number): void;
  /** Fade the whole trail (1 = full, 0 = gone). */
  fade(f: number): void;
  dispose(): void;
}

export function createCurtainTrail(globe: GlobeInstance, from: LatLng, to: LatLng): CurtainTrail {
  const scene = globe.scene();
  const group = new THREE.Group();
  scene.add(group);

  const a = toVec(from.lat, from.lng);
  const b = toVec(to.lat, to.lng);
  const distDeg = (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
  const peak = Math.min(0.45, 0.04 + distDeg / 160);
  const path = Array.from({ length: SAMPLES + 1 }, (_, i) => fromVec(slerp(a, b, i / SAMPLES)));
  const height = (i: number) => 0.002 + peak * Math.sin((Math.PI * i) / SAMPLES);
  const at = (p: LatLng, alt: number) => {
    const c = globe.getCoords(p.lat, p.lng, alt);
    return new THREE.Vector3(c.x, c.y, c.z);
  };

  const ground = hairline(path.map((p) => at(p, 0.0015)), 0.5);
  const arc = hairline(path.map((p, i) => at(p, height(i))), 0.95);
  const dropPts: THREE.Vector3[] = [];
  for (let i = 0; i <= SAMPLES; i += DROP_EVERY) dropPts.push(at(path[i], 0.0015), at(path[i], height(i)));
  const drops = hairline(dropPts, 0.45, true);
  const lines = [ground, arc, drops];
  group.add(...lines);

  return {
    reveal(e) {
      const n = Math.round(Math.max(0, Math.min(1, e)) * SAMPLES) + 1;
      ground.geometry.setDrawRange(0, n);
      arc.geometry.setDrawRange(0, n);
      drops.geometry.setDrawRange(0, (Math.floor((n - 1) / DROP_EVERY) + 1) * 2);
    },
    fade(f) {
      for (const l of lines) (l.material as THREE.LineBasicMaterial).opacity = l.userData.opacity * f;
    },
    dispose() {
      scene.remove(group);
      for (const l of lines) {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      }
    },
  };
}
