import { MapContainer, TileLayer } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Seizure, DistrictAggregate, DistrictFeature } from '../types';
import { DistrictLayer } from './DistrictLayer';
import styles from './IndiaMap.module.css';

interface Props {
  seizures: Seizure[];
  /** Festival/rave seizure list — still accepted as a prop for forward-compat
   *  (e.g. upcoming side-panel filter hooks may read it), but no longer
   *  rendered as per-seizure circles. The district choropleth carries the
   *  intensity story for the rave view instead. */
  raveSeizures?: Seizure[];
  onSeizureSelect: (seizure: Seizure) => void;
  /** Pre-aggregated per-district data for the main (radar) view. */
  byDistrict?: Record<string, DistrictAggregate> | null;
  /** Pre-aggregated per-district data for the festival/rave view. */
  byDistrictRave?: Record<string, DistrictAggregate> | null;
  /** Click handler for a district polygon. */
  onDistrictClick?: (aggregate: DistrictAggregate | null, feature: DistrictFeature) => void;
}

const INDIA_CENTER: L.LatLngExpression = [20.5937, 78.9625];

export function IndiaMap({
  seizures,
  raveSeizures,
  onSeizureSelect,
  byDistrict = null,
  byDistrictRave = null,
  onDistrictClick,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonAdded = useRef(false);

  // Both `seizures` and `raveSeizures` are intentionally not rendered as
  // per-seizure circles — the district choropleth below carries the
  // intensity story for both the main and rave views. Acknowledged so
  // future filter hooks can still rely on the prop shape.
  void seizures;
  void raveSeizures;
  void onSeizureSelect;

  // India outline — cyan, no fill. Loaded once and never rebuilt.
  useEffect(() => {
    if (!mapRef.current || geoJsonAdded.current) return;
    geoJsonAdded.current = true;

    fetch('/india-boundary.geojson')
      .then(res => res.json())
      .then(data => {
        if (!mapRef.current) return;
        L.geoJSON(data, {
          style: {
            color: '#00FFFF',
            weight: 1.5,
            fillOpacity: 0,
            opacity: 0.6,
          },
        }).addTo(mapRef.current);
      })
      .catch(err => console.warn('[IndiaMap] GeoJSON load failed:', err));
  }, []);

  return (
    <div className={styles.container}>
      <MapContainer
        center={INDIA_CENTER}
        zoom={4}
        minZoom={3}
        maxZoom={8}
        attributionControl={false}
        className={styles.map}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        // preferCanvas disabled — react-leaflet 5 + Leaflet 1.9 doesn't reliably
        // render Circle to canvas; keeping SVG paths so districts stay clickable.
        ref={(map) => {
          if (map) mapRef.current = map;
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={['a', 'b', 'c', 'd']}
        />

        {/* District choropleth — main (radar) view: aggregates the
            standard seizure dataset by district. Renders unchanged. */}
        <DistrictLayer
          byDistrict={byDistrict}
          onDistrictClick={onDistrictClick}
        />

        {/* District choropleth — festival/rave view: aggregates the
            rave seizure dataset by district. Palette is driven entirely
            by [data-mode="rave"] on the shell (see design-system.css),
            so the same component swaps colors automatically. */}
        <DistrictLayer
          byDistrict={byDistrictRave}
          onDistrictClick={onDistrictClick}
        />
      </MapContainer>
    </div>
  );
}