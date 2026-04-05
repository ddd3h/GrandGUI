import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUiStore } from '../../stores/uiStore';
import { toDms } from '../../types';
import type { TelemetryPoint, ActiveMapPackage } from '../../types';
import { api } from '../../api/client';

interface MapWidgetProps {
  trackLength?: number;
}

type MapStyleType = 'osm' | 'satellite';

interface UserLocation {
  lat: number;
  lng: number;
}

// Build MapLibre style with OSM + satellite layers.
// offlinePkg: active raster MBTiles package, or null for online-only mode.
function buildMapStyle(offlinePkg: ActiveMapPackage | null): maplibregl.StyleSpecification {
  const sources: maplibregl.StyleSpecification['sources'] = {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
    'satellite-online': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles © Esri',
      maxzoom: 19,
    },
  };

  if (offlinePkg?.is_raster) {
    sources['satellite-offline'] = {
      type: 'raster',
      tiles: [offlinePkg.tile_url_template],
      tileSize: 256,
      attribution: `© ${offlinePkg.name}`,
      minzoom: 0,
      maxzoom: 22,
    };
  }

  const layers: maplibregl.StyleSpecification['layers'] = [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      layout: { visibility: 'visible' },
    },
    {
      id: 'satellite-online-tiles',
      type: 'raster',
      source: 'satellite-online',
      layout: { visibility: 'none' },
    },
  ];

  if (offlinePkg?.is_raster) {
    layers.push({
      id: 'satellite-offline-tiles',
      type: 'raster',
      source: 'satellite-offline',
      layout: { visibility: 'none' },
    });
  }

  return { version: 8, sources, layers };
}

export function MapWidget({ trackLength = 500 }: MapWidgetProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const gpsMarkerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const { history, latest } = useTelemetryStore();
  const { coordFormat, mapFollowCurrent, setMapFollowCurrent } = useUiStore();

  const [mapStyle, setMapStyle] = useState<MapStyleType>('osm');
  const [activePkg, setActivePkg] = useState<ActiveMapPackage | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Fetch active offline package on mount
  useEffect(() => {
    api.getActiveMapPackage()
      .then((pkg) => setActivePkg(pkg))
      .catch(() => setActivePkg(null));
  }, []);

  // Initialize map — depends on activePkg (set before first render via the effect above,
  // but since the fetch is async, the map initializes first with online-only style,
  // then updates when activePkg arrives).
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(activePkg),
      center: [139.7671, 35.6812],
      zoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Telemetry track line
      map.addSource('track', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 2 },
      });

      // Telemetry history points
      map.addSource('points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'track-points',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': 3,
          'circle-color': '#60a5fa',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#1d4ed8',
        },
      });
    });

    map.on('dragstart', () => setMapFollowCurrent(false));

    mapRef.current = map;
    markerRef.current = null;
    gpsMarkerRef.current = null;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMapFollowCurrent]);
  // Note: activePkg is intentionally excluded — we handle layer updates in the effect below
  // to avoid full map re-initialization when the package changes.

  // When activePkg changes after map is already initialized:
  // add satellite-offline source/layer if not present.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activePkg?.is_raster) return;

    const addOfflineLayers = () => {
      if (!map.getSource('satellite-offline')) {
        map.addSource('satellite-offline', {
          type: 'raster',
          tiles: [activePkg.tile_url_template],
          tileSize: 256,
          attribution: `© ${activePkg.name}`,
          minzoom: 0,
          maxzoom: 22,
        });
      }
      if (!map.getLayer('satellite-offline-tiles')) {
        // Insert below the telemetry layers so track stays on top
        const beforeLayer = map.getLayer('track-line') ? 'track-line' : undefined;
        map.addLayer(
          {
            id: 'satellite-offline-tiles',
            type: 'raster',
            source: 'satellite-offline',
            layout: { visibility: mapStyle === 'satellite' ? 'visible' : 'none' },
          },
          beforeLayer,
        );
      }
    };

    if (map.isStyleLoaded()) {
      addOfflineLayers();
    } else {
      map.once('load', addOfflineLayers);
    }
  }, [activePkg, mapStyle]);

  // Apply layer visibility when mapStyle or activePkg changes
  const applyVisibility = useCallback((style: MapStyleType) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const isSat = style === 'satellite';
    const hasOffline = activePkg?.is_raster && map.getLayer('satellite-offline-tiles');

    map.setLayoutProperty('osm-tiles', 'visibility', isSat ? 'none' : 'visible');
    map.setLayoutProperty('satellite-online-tiles', 'visibility',
      isSat && !hasOffline ? 'visible' : 'none');
    if (map.getLayer('satellite-offline-tiles')) {
      map.setLayoutProperty('satellite-offline-tiles', 'visibility',
        isSat && !!hasOffline ? 'visible' : 'none');
    }
  }, [activePkg]);

  const toggleMapStyle = useCallback(() => {
    const next: MapStyleType = mapStyle === 'osm' ? 'satellite' : 'osm';
    setMapStyle(next);
    applyVisibility(next);
  }, [mapStyle, applyVisibility]);

  // Update track and telemetry marker when history changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const pts = history
      .slice(-trackLength)
      .filter((p): p is TelemetryPoint & { latitude: number; longitude: number } =>
        p.latitude != null && p.longitude != null
      );

    if (pts.length === 0) return;

    const coords = pts.map((p) => [p.longitude, p.latitude] as [number, number]);
    (map.getSource('track') as maplibregl.GeoJSONSource)?.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    });
    (map.getSource('points') as maplibregl.GeoJSONSource)?.setData({
      type: 'FeatureCollection',
      features: pts.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: { altitude: p.altitude },
      })),
    });
  }, [history, trackLength]);

  // Update telemetry current position marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !latest?.latitude || !latest?.longitude) return;

    const lngLat: maplibregl.LngLatLike = [latest.longitude, latest.latitude];
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg';
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
    } else {
      markerRef.current.setLngLat(lngLat);
    }
    if (mapFollowCurrent) {
      map.easeTo({ center: lngLat, duration: 500 });
    }
  }, [latest, mapFollowCurrent]);

  // GPS: start/stop browser geolocation
  useEffect(() => {
    if (!gpsEnabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      setUserLocation(null);
      return;
    }
    if (!navigator.geolocation) {
      setGpsError('このブラウザはGeolocation非対応です');
      setGpsEnabled(false);
      return;
    }
    setGpsError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(null);
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [gpsEnabled]);

  // Update GPS marker on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    const lngLat: maplibregl.LngLatLike = [userLocation.lng, userLocation.lat];
    if (!gpsMarkerRef.current) {
      if (!document.getElementById('gps-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'gps-pulse-style';
        style.textContent = `
          @keyframes gps-pulse {
            0% { transform: scale(0.5); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
          }`;
        document.head.appendChild(style);
      }
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;width:20px;height:20px';
      const pulse = document.createElement('div');
      pulse.style.cssText = 'position:absolute;inset:0;background:rgba(59,130,246,0.3);border-radius:50%;animation:gps-pulse 2s ease-out infinite';
      const dot = document.createElement('div');
      dot.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:12px;height:12px;background:#3b82f6;border-radius:50%;border:2px solid white;box-shadow:0 0 6px rgba(59,130,246,0.8)';
      wrapper.appendChild(pulse);
      wrapper.appendChild(dot);
      gpsMarkerRef.current = new maplibregl.Marker({ element: wrapper }).setLngLat(lngLat).addTo(map);
    } else {
      gpsMarkerRef.current.setLngLat(lngLat);
    }
  }, [userLocation]);

  const centerOnGps = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: 15, duration: 600 });
  }, [userLocation]);

  const formatCoord = (val: number | undefined, isLat: boolean) => {
    if (val == null) return '---';
    return coordFormat === 'dms' ? toDms(val, isLat) : val.toFixed(6);
  };

  const satelliteIsOffline = mapStyle === 'satellite' && activePkg?.is_raster;

  return (
    <div className="relative w-full h-full rounded overflow-hidden" style={{ minHeight: 300 }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* Coordinate overlay */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono z-10">
        <div>Lat: {formatCoord(latest?.latitude, true)}</div>
        <div>Lon: {formatCoord(latest?.longitude, false)}</div>
        {latest?.altitude != null && <div>Alt: {latest.altitude.toFixed(1)} m</div>}
        {userLocation && (
          <div className="text-blue-300 mt-1 border-t border-gray-600 pt-1">
            GPS: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
          </div>
        )}
      </div>

      {/* Top-left controls */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
        {/* Follow telemetry */}
        <button
          onClick={() => setMapFollowCurrent(!mapFollowCurrent)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            mapFollowCurrent ? 'bg-blue-600 text-white' : 'bg-black/70 text-gray-300 hover:bg-black/90'
          }`}
        >
          {mapFollowCurrent ? '⊙ Follow' : '○ Follow'}
        </button>

        {/* Satellite/OSM toggle */}
        <button
          onClick={toggleMapStyle}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            mapStyle === 'satellite'
              ? satelliteIsOffline ? 'bg-green-700 text-white' : 'bg-yellow-600 text-white'
              : 'bg-black/70 text-gray-300 hover:bg-black/90'
          }`}
          title={satelliteIsOffline ? `オフライン衛星: ${activePkg?.name}` : ''}
        >
          {mapStyle === 'satellite'
            ? satelliteIsOffline ? '🛰 衛星 [オフライン]' : '🛰 衛星 [オンライン]'
            : '🗺 地図'}
        </button>

        {/* GPS toggle */}
        <button
          onClick={() => setGpsEnabled((v) => !v)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            gpsEnabled ? 'bg-green-600 text-white' : 'bg-black/70 text-gray-300 hover:bg-black/90'
          }`}
        >
          {gpsEnabled ? '📍 GPS ON' : '📍 GPS'}
        </button>

        {gpsEnabled && userLocation && (
          <button
            onClick={centerOnGps}
            className="px-2 py-1 rounded text-xs font-medium bg-black/70 text-blue-300 hover:bg-black/90"
          >
            ⊕ 現在地
          </button>
        )}
      </div>

      {/* Offline package indicator */}
      {activePkg?.is_raster && mapStyle === 'satellite' && (
        <div className="absolute top-2 right-14 bg-green-900/80 text-green-300 text-xs px-2 py-1 rounded z-10 max-w-[160px] truncate">
          {activePkg.name}
        </div>
      )}

      {/* GPS error */}
      {gpsError && (
        <div className="absolute top-2 right-14 bg-red-900/80 text-red-200 text-xs px-2 py-1 rounded z-10">
          GPS: {gpsError}
        </div>
      )}
    </div>
  );
}

