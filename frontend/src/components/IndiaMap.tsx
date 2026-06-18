import { MapContainer, TileLayer } from 'react-leaflet';
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Seizure } from '../types';
import { SeizureArea } from './SeizureArea';
import styles from './IndiaMap.module.css';

interface Props {
  seizures: Seizure[];
  raveSeizures?: Seizure[];
  onSeizureSelect: (seizure: Seizure) => void;
}

const INDIA_CENTER: L.LatLngExpression = [20.5937, 78.9625];

function hasCoords(s: Seizure): boolean {
  const lat = s.location?.lat;
  const lon = s.location?.lon;
  return typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon);
}

export function IndiaMap({ seizures, raveSeizures = [], onSeizureSelect }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonAdded = useRef(false);

  // Pre-filter to valid coords so we never mount a marker at [0,0] / NaN
  const mainMarkers  = useMemo(() => seizures.filter(hasCoords),       [seizures]);
  const raveMarkers  = useMemo(() => raveSeizures.filter(hasCoords),   [raveSeizures]);

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
        // render Circle to canvas; keeping SVG paths so seizures stay clickable.
        ref={(map) => {
          if (map) mapRef.current = map;
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={['a', 'b', 'c', 'd']}
        />
        {mainMarkers.map((seizure) => (
          <SeizureArea
            key={seizure.id}
            seizure={seizure}
            onSelect={onSeizureSelect}
            theme="main"
          />
        ))}
        {raveMarkers.map((seizure) => (
          <SeizureArea
            key={seizure.id}
            seizure={seizure}
            onSelect={onSeizureSelect}
            theme="rave"
          />
        ))}
      </MapContainer>
    </div>
  );
}