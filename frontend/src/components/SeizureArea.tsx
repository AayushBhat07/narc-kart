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
// Sized for visibility at zoom 4 (full-India view): all three tiers
// produce readable blobs. The relative spread (4× / 2× / 1×) carries
// the intensity story without making low-severity dots invisible.
const RADIUS_BY_SEVERITY: Record<Severity, number> = {
  critical: 180_000, // 180 km — large intensity blob (~70px @ z4)
  high:      90_000, //  90 km — medium blob (~35px @ z4)
  low:       45_000, //  45 km — visible dot (~18px @ z4)
};

const FILL_BY_SEVERITY: Record<Severity, { color: string; fillOpacity: number; strokeOpacity: number; weight: number }> = {
  critical: { color: '#E83D3D', fillOpacity: 0.34, strokeOpacity: 0.75, weight: 1.4 },
  high:     { color: '#FF8C42', fillOpacity: 0.24, strokeOpacity: 0.55, weight: 1.1 },
  low:      { color: '#FFCC00', fillOpacity: 0.16, strokeOpacity: 0.45, weight: 0.9 },
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
