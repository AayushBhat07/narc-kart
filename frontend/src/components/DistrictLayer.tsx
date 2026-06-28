/* Hallmark · genre: tactical · layer: district choropleth */
import { useEffect, useState, useCallback } from 'react';
import { GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import type { Layer, PathOptions, StyleFunction } from 'leaflet';
import type { GeoJsonObject, Feature as GeoJSONFeature, Geometry } from 'geojson';
import {
  DistrictAggregate,
  DistrictFeature,
  DistrictFeatureCollection,
  DistrictTier,
} from '../types';
import './DistrictLayer.module.css';

/* ── Tier thresholds (log-scaled) ────────────────────────────
   Mumbai 349 kg → high; Wardha 302k kg → critical; Delhi 33k kg → critical;
   Goa 57 kg → low. Tuned so a few "anchor" districts anchor the
   heatmap while the long tail still reads as high/orange. */
const TIER_CRITICAL_KG = 10_000;
const TIER_HIGH_KG     = 100;

export type DistrictLayerMode = 'main' | 'rave';

export interface DistrictLayerProps {
  /** Pre-aggregated district data, keyed by `${NAME_2}|${NAME_1}`. */
  byDistrict: Record<string, DistrictAggregate> | null;
  /** Click handler. Receives the aggregate (null if district is unmatched) + the
   *  raw GeoJSON feature so callers can read extra properties if needed. */
  onDistrictClick?: (aggregate: DistrictAggregate | null, feature: DistrictFeature) => void;
  /**
   * Visual / copy mode. In `rave` mode, the unmatched-district tooltip
   * copy is rewritten so it doesn't claim there are "no seizures" — in
   * festival intel the absence of a rave/festival incident is not the
   * same as zero overall enforcement activity, and the original copy
   * was misleading Aayush when most districts (where there are no rave
   * seizures) lit up with "0 seizures" tooltips. Defaults to 'main'.
   */
  mode?: DistrictLayerMode;
}

function tierFor(totalKg: number | undefined): DistrictTier | 'none' {
  if (typeof totalKg !== 'number' || totalKg <= 0) return 'none';
  if (totalKg > TIER_CRITICAL_KG) return 'critical';
  if (totalKg > TIER_HIGH_KG)     return 'high';
  return 'low';
}

function formatKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  if (kg >= 1)    return `${kg.toFixed(0)}kg`;
  return `${kg.toFixed(1)}kg`;
}

function buildLookupKey(feature: DistrictFeature): string {
  const props = feature.properties ?? ({} as DistrictFeature['properties']);
  const district = props.NAME_2 ?? '';
  const state = props.NAME_1 ?? '';
  return `${district}|${state}`;
}

export function DistrictLayer({ byDistrict, onDistrictClick, mode = 'main' }: DistrictLayerProps) {
  const [geoData, setGeoData] = useState<DistrictFeatureCollection | null>(null);

  // Load the heavy 4.5MB GeoJSON once at mount. While loading or on
  // error we render nothing — the map keeps working without the
  // choropleth, so a slow load never breaks the rest of the app.
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}india-districts.geojson`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DistrictFeatureCollection>;
      })
      .then((json) => {
        if (!cancelled) setGeoData(json);
      })
      .catch((err) => {
        if (!cancelled) console.error('[DistrictLayer] GeoJSON load failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Memoize so the GeoJSON layer doesn't re-bind on every parent re-render.
  // onEachFeature in particular is expensive (one closure per feature).
  const handleEachFeature = useCallback(
    (feature: GeoJSONFeature<Geometry, unknown>, layer: Layer) => {
      const typedFeature = feature as unknown as DistrictFeature;
      const key = buildLookupKey(typedFeature);
      const aggregate = byDistrict?.[key] ?? null;
      const layerWithPath = layer as L.Path;

      if (aggregate) {
        const tooltipHtml =
          `<span style="color:var(--text-primary)">${aggregate.district} · ${aggregate.state}</span>\n` +
          `${aggregate.count} seizures · ${formatKg(aggregate.totalKg)}`;
        layerWithPath.bindTooltip(tooltipHtml, {
          sticky: true,
          direction: 'top',
          offset: [0, -4],
          className: 'district-tooltip',
          opacity: 1,
        });
      } else {
        // Even unmatched districts get a tooltip — just the name. Copy
        // adapts to the active layer mode: in `rave` mode a district
        // without a rave/festival incident isn't the same as a district
        // with zero overall enforcement activity, so we surface that
        // distinction instead of saying "no recorded seizures" (which
        // was misleading Aayush on the festival view, where most
        // districts in India legitimately have no rave seizure yet
        // still report thousands of regular seizures).
        const props = typedFeature.properties ?? ({} as DistrictFeature['properties']);
        const tipBody = mode === 'rave'
          ? 'No rave/festival incidents on record'
          : 'No recorded seizures';
        layerWithPath.bindTooltip(
          `${props.NAME_2 ?? 'Unknown'} · ${props.NAME_1 ?? ''}\n${tipBody}`,
          {
            sticky: true,
            direction: 'top',
            offset: [0, -4],
            className: 'district-tooltip',
            opacity: 1,
          }
        );
      }

      layer.on('click', () => {
        onDistrictClick?.(aggregate, typedFeature);
      });
    },
    [byDistrict, onDistrictClick, mode]
  );

  // Stable style fn: tier className drives the actual color via CSS
  // (see DistrictLayer.module.css). The values here are fallbacks so
  // paths render correctly even before CSS loads.
  const styleFn = useCallback<StyleFunction>((feat) => {
    const feature = feat as DistrictFeature | undefined;
    const key = feature ? buildLookupKey(feature) : '';
    const aggregate = byDistrict?.[key];
    const tier = tierFor(aggregate?.totalKg);
    const base: PathOptions = {
      className: `district district--${tier}`,
      // Fill is owned by CSS, but Leaflet requires *something* here or
      // the default blue flash shows through for a paint. The CSS rule
      // overrides these on render.
      fillColor: '#888',
      fillOpacity: 0.5,
      color: '#000',
      weight: 0.5,
      // Allow the tooltip to be a normal hover affordance.
      interactive: true,
    };
    return base;
  }, [byDistrict]);

  // Render nothing until the geojson has loaded. This is intentional —
  // a flash of empty map beats a half-painted choropleth.
  if (!geoData) return null;

  // `key` is a stable string: we only ever mount the GeoJSON once
  // (geoData is set once, in the useEffect above), so this prevents
  // react-leaflet from rebuilding the layer on parent re-renders.
  // The `data` reference is stable for the same reason.
  return (
    <GeoJSON
      key="districts-loaded"
      data={geoData as unknown as GeoJsonObject}
      style={styleFn}
      onEachFeature={handleEachFeature}
    />
  );
}
