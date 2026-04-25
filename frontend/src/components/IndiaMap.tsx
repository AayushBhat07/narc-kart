import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Seizure } from '../types';
import { SeizureMarker } from './SeizureMarker';
import styles from './IndiaMap.module.css';

interface Props {
  seizures: Seizure[];
  onSeizureSelect: (seizure: Seizure) => void;
}

const INDIA_CENTER: L.LatLngExpression = [20.5937, 78.9625];

export function IndiaMap({ seizures, onSeizureSelect }: Props) {
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
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={['a', 'b', 'c', 'd']}
        />
        {seizures.map((seizure) => (
          <SeizureMarker
            key={seizure.id}
            seizure={seizure}
            onSelect={onSeizureSelect}
          />
        ))}
      </MapContainer>
      <div className={styles.radarOverlay}>
        <div className={styles.radarSweep} />
        <div className={styles.radarCenter} />
      </div>
    </div>
  );
}
