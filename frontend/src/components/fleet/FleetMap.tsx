import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Vessel } from '../../api/vessels';

interface FleetMapProps {
  vessels: Vessel[];
}

export const FleetMap: React.FC<FleetMapProps> = ({ vessels }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map if it doesn't exist yet
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [18.95, 72.82], // Default Mumbai center
        zoom: 6,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach(m => {
      if (mapRef.current) {
        m.remove();
      }
    });
    markersRef.current = [];

    // Add new markers
    const bounds: L.LatLngTuple[] = [];

    vessels.forEach(v => {
      if (typeof v.latitude === 'number' && typeof v.longitude === 'number') {
        const color =
          v.status === 'ACTIVE' ? '#10b981' : // emerald
          v.status === 'IN_PORT' ? '#0ea5e9' : // sky
          v.status === 'MAINTENANCE' ? '#f59e0b' : // amber
          v.status === 'NON_COMPLIANT' ? '#ef4444' : // red
          '#64748b'; // slate

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

        const icon = L.divIcon({
          html: svg,
          className: 'custom-vessel-leaflet-pin',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        const popupContent = `
          <div style="color: #0f172a; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.4; min-width: 160px; padding: 2px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px; color: #1e293b;">${v.name}</div>
            <div style="color: #64748b; font-size: 10px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">${v.type} • Reg: ${v.registrationNo}</div>
            
            <div style="margin-bottom: 6px;">
              <span style="background-color: ${color}15; color: ${color}; border: 1px solid ${color}30; padding: 2px 6px; border-radius: 9999px; font-weight: 700; font-size: 9px; text-transform: uppercase; display: inline-block;">
                ${v.status.replace('_', ' ')}
              </span>
            </div>
            
            <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px; font-size: 11px;">
              <strong style="color: #475569;">Location:</strong> ${v.currentLocation}<br/>
              <strong style="color: #475569;">Coords:</strong> ${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}<br/>
              <strong style="color: #475569;">Updated:</strong> ${new Date(v.updatedAt).toLocaleDateString()}
            </div>
            
            <div style="margin-top: 8px; text-align: right;">
              <a href="/fleet/${v.id}" style="color: #0284c7; text-decoration: none; font-weight: 700; font-size: 10px; display: inline-flex; align-items: center;">
                View Details &rarr;
              </a>
            </div>
          </div>
        `;

        const marker = L.marker([v.latitude, v.longitude], { icon })
          .addTo(mapRef.current!)
          .bindPopup(popupContent);

        markersRef.current.push(marker);
        bounds.push([v.latitude, v.longitude]);
      }
    });

    // Fit map bounds if there are markers, otherwise use default Mumbai center
    if (bounds.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [45, 45], maxZoom: 9 });
    }
  }, [vessels]);

  // Clean up map instance on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative h-[480px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950 z-0">
      {/* Global CSS injection for Leaflet divIcon overrides */}
      <style>{`
        .custom-vessel-leaflet-pin {
          background: transparent !important;
          border: none !important;
        }
        /* Leaflet dark theme tweaks */
        .leaflet-popup-content-wrapper {
          background: #ffffff !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          border: 1px solid rgba(0,0,0,0.05) !important;
        }
        .leaflet-popup-tip {
          background: #ffffff !important;
        }
      `}</style>
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
};
