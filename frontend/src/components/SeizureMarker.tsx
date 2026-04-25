import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { Seizure } from '../types';
import styles from './SeizureMarker.module.css';

interface Props {
  seizure: Seizure;
  onSelect: (seizure: Seizure) => void;
}

function getSeverityColor(quantityKg: number): string {
  if (quantityKg > 100) return '#FF0040';
  if (quantityKg > 10) return '#FF6600';
  return '#FFCC00';
}

function getRadius(quantityKg: number): number {
  if (quantityKg > 100) return 12;
  if (quantityKg > 10) return 8;
  return 5;
}

export function SeizureMarker({ seizure, onSelect }: Props) {
  const color = getSeverityColor(seizure.quantityKg);
  const radius = getRadius(seizure.quantityKg);
  const isMajor = seizure.quantityKg > 100;

  const svgSize = radius * 4;
  const svgCenter = radius * 2;
  const pulseAnimation = isMajor
    ? `<animate attributeName="r" from="${radius}" to="${radius * 2.5}" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/>`
    : '';

  const icon = L.divIcon({
    className: styles.markerWrapper,
    html: `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${svgCenter}" cy="${svgCenter}" r="${radius}" fill="${color}" stroke="${color}" stroke-width="2"/>
      ${isMajor ? `<circle cx="${svgCenter}" cy="${svgCenter}" r="${radius}" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">${pulseAnimation}</circle>` : ''}
    </svg>`,
    iconSize: [svgSize, svgSize],
    iconAnchor: [svgCenter, svgCenter],
  });

  return (
    <Marker
      position={[seizure.location.lat, seizure.location.lon]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(seizure) }}
    />
  );
}