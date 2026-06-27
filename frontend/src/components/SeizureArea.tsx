import { memo, useMemo } from 'react';
import { Circle } from 'react-leaflet';
import { Seizure } from '../types';
import styles from './SeizureArea.module.css';

/**
 * SeizureArea — replaces the old shield-style marker.
 *
 * Each seizure is rendered as a translucent circle whose radius and
 * fill opacity are scaled by severity (quantityKg). Overlapping circles
 * naturally aggregate into "intensity blobs" — you read clusters at a
 * glance, and individual seizures are still clickable.
 *
 * Two themes:
 *   - 'main' : war-room red/orange/yellow
 *   - 'rave' : magenta/cyan/lime (festival intel)
 *
 * Mode-switch fade is handled by CSS so the layer never tears down.
 */

interface Props {
  seizure: Seizure;
  onSelect: (seizure: Seizure) => void;
  theme?: 'main' | 'rave';
}

type Severity = 'critical' | 'high' | 'low';

function getSeverity(quantityKg: number): Severity {
  if (quantityKg > 100) return 'critical';
  if (quantityKg > 10) return 'high';
  return 'low';
}

// Geographic radius in meters — Leaflet converts to pixels at the
// current zoom, so circles stay geographically meaningful when panning.
// Sized so individual seizures read as distinct hotspots at zoom 4
// (full-India view) while overlapping ones still merge into
// intensity blobs. Critical sits at ~30px @ z4, high at ~17px, low at
// ~9px — small enough to see distinct points, big enough that a few
// nearby raids merge into a recognisable hotspot.
const RADIUS_BY_SEVERITY: Record<Severity, number> = {
  critical: 75_000, //  75 km — clear hotspot (~30px @ z4)
  high:     40_000, //  40 km — visible spot (~17px @ z4)
  low:      22_000, //  22 km — pinpoint dot (~9px @ z4)
};

const FILL_BY_SEVERITY: Record<Severity, { color: string; fillOpacity: number; strokeOpacity: number; weight: number }> = {
  critical: { color: '#E83D3D', fillOpacity: 0.42, strokeOpacity: 0.85, weight: 1.4 },
  high:     { color: '#FF8C42', fillOpacity: 0.30, strokeOpacity: 0.65, weight: 1.1 },
  low:      { color: '#FFCC00', fillOpacity: 0.22, strokeOpacity: 0.55, weight: 0.9 },
};

const RAVE_BY_SEVERITY: Record<Severity, { color: string; fillOpacity: number; strokeOpacity: number; weight: number }> = {
  critical: { color: '#FF1B8D', fillOpacity: 0.32, strokeOpacity: 0.75, weight: 1.4 },
  high:     { color: '#00E5FF', fillOpacity: 0.24, strokeOpacity: 0.60, weight: 1.1 },
  low:      { color: '#B6FF00', fillOpacity: 0.16, strokeOpacity: 0.45, weight: 0.9 },
};

function SeizureAreaInner({ seizure, onSelect, theme = 'main' }: Props) {
  const path = useMemo(() => {
    const sev = getSeverity(seizure.quantityKg);
    const palette = theme === 'rave' ? RAVE_BY_SEVERITY[sev] : FILL_BY_SEVERITY[sev];
    return {
      radius: RADIUS_BY_SEVERITY[sev],
      ...palette,
    };
  }, [seizure.quantityKg, theme]);

  return (
    <Circle
      center={[seizure.location.lat, seizure.location.lon]}
      radius={path.radius}
      pathOptions={{
        color: path.color,
        fillColor: path.color,
        fillOpacity: path.fillOpacity,
        opacity: path.strokeOpacity,
        weight: path.weight,
        // Smooth repaint instead of a hard circle edge
        lineCap: 'round',
        lineJoin: 'round',
      }}
      className={`${styles.areaWrapper} ${styles[`theme--${theme}`]} ${styles[`sev--${getSeverity(seizure.quantityKg)}`]}`}
      eventHandlers={{ click: () => onSelect(seizure) }}
    />
  );
}

export const SeizureArea = memo(SeizureAreaInner);
