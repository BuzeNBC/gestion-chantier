import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { TILE_LAYER, markerColor, coordsOf, hasCoords, distanceLabel } from '../../services/geoUtils';
import { LILLE_CENTER } from '../../services/geocodingService';
import { directionsUrls, orderRelances, categoryLabel, orderCategory, typeLabel, orderInterventions } from '../../services/menuiserieService';
import { scheduledLabel } from '../../services/planningService';

// Carte des bons (Leaflet + OpenStreetMap), chargée à la demande.
// Les marqueurs sont des CircleMarker (pas d'icône PNG : évite le bug
// classique des icônes Leaflet sous webpack) colorés selon l'urgence.
//
// Props :
//   orders        bons (ceux sans coordonnées sont ignorés)
//   center        { lat, lng } : centre + cercle de rayon (optionnel)
//   radiusKm      rayon du cercle (optionnel)
//   userPosition  { lat, lng, accuracy } (optionnel)
//   selectedId    bon mis en avant
//   onSelect(order)        « Ouvrir le bon »
//   onPickCenter({lat,lng}) tap sur la carte (choix manuel du centre)
//   fit           ajuste le zoom pour voir tous les marqueurs au montage
//   className     hauteur OBLIGATOIRE (ex. h-[60vh], h-56)

// Le prop `center` de MapContainer n'est lu qu'au montage : on recentre à la main.
const Recenter = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
  }, [center?.lat, center?.lng, zoom, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

const FitBounds = ({ points, enabled }) => {
  const map = useMap();
  useEffect(() => {
    if (!enabled || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
    }
  }, [enabled, points.length, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

// Dans un modal / un onglet, la carte peut être montée avant d'avoir sa
// taille finale : sans invalidateSize, les tuiles restent grises.
const InvalidateSize = () => {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 0);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map]);
  return null;
};

const ClickCapture = ({ onPickCenter }) => {
  useMapEvents({
    click: (e) => onPickCenter?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
};

export default function OrdersMap({
  orders = [],
  center = null,
  radiusKm = null,
  userPosition = null,
  selectedId = null,
  onSelect,
  onPickCenter,
  fit = false,
  className = 'h-[60vh]',
}) {
  const located = useMemo(() => orders.filter(hasCoords), [orders]);
  const points = useMemo(() => located.map((o) => [Number(o.latitude), Number(o.longitude)]), [located]);
  const initialCenter = center || userPosition || (points[0] ? { lat: points[0][0], lng: points[0][1] } : LILLE_CENTER);

  return (
    <div className={`${className} w-full rounded-lg overflow-hidden border border-gray-200`}>
      <MapContainer
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={center ? 13 : 12}
        scrollWheelZoom
        className="h-full w-full"
        style={{ zIndex: 0 }}
      >
        <TileLayer url={TILE_LAYER.url} attribution={TILE_LAYER.attribution} maxZoom={TILE_LAYER.maxZoom} />
        <InvalidateSize />
        <Recenter center={center} zoom={center ? 13 : undefined} />
        <FitBounds points={points} enabled={fit && !center} />
        {onPickCenter && <ClickCapture onPickCenter={onPickCenter} />}

        {center && radiusKm && (
          <Circle
            center={[center.lat, center.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#2563eb', weight: 1, dashArray: '4 4', fillColor: '#2563eb', fillOpacity: 0.06 }}
          />
        )}
        {center && (
          <CircleMarker
            center={[center.lat, center.lng]}
            radius={6}
            pathOptions={{ color: '#1d4ed8', weight: 2, fillColor: '#60a5fa', fillOpacity: 1 }}
          >
            <Popup>Centre de la recherche</Popup>
          </CircleMarker>
        )}
        {userPosition && (
          <CircleMarker
            center={[userPosition.lat, userPosition.lng]}
            radius={8}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
          >
            <Popup>Vous êtes ici</Popup>
          </CircleMarker>
        )}

        {located.map((o) => {
          const c = coordsOf(o);
          const dirs = directionsUrls(o);
          const ivs = orderInterventions(o);
          const selected = o.id === selectedId;
          const dist = center ? o.distanceKm : null;
          return (
            <CircleMarker
              key={o.id}
              center={[c.lat, c.lng]}
              radius={selected ? 12 : 9}
              pathOptions={{
                color: selected ? '#111827' : '#ffffff',
                weight: selected ? 3 : 2,
                fillColor: markerColor(o),
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <div className="space-y-1 min-w-[180px]">
                  <div className="font-semibold text-gray-900">{o.client_name || 'Client'}</div>
                  {ivs[0] && <div className="text-xs text-blue-700">{typeLabel(ivs[0].type)}{ivs.length > 1 ? ` +${ivs.length - 1}` : ''}</div>}
                  {o.address && <div className="text-xs text-gray-600">{o.address}</div>}
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {o.is_urgent && <span className="px-1.5 rounded-full bg-red-600 text-white font-bold">URGENT</span>}
                    {orderRelances(o).length > 0 && <span className="px-1.5 rounded-full bg-orange-100 text-orange-800">{orderRelances(o).length} relance{orderRelances(o).length > 1 ? 's' : ''}</span>}
                    {orderCategory(o) === 'commande_portes' && <span className="px-1.5 rounded-full bg-indigo-100 text-indigo-800">{categoryLabel('commande_portes')}</span>}
                    {o.scheduled_date && <span className="px-1.5 rounded-full bg-gray-100 text-gray-700">{scheduledLabel(o, { withDuration: false })}</span>}
                    {Number.isFinite(dist) && <span className="px-1.5 rounded-full bg-blue-100 text-blue-800">{distanceLabel(dist)}</span>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    {onSelect && (
                      <button
                        onClick={() => onSelect(o)}
                        className="px-2.5 py-1.5 rounded bg-blue-600 text-white text-xs font-medium"
                      >
                        Ouvrir le bon
                      </button>
                    )}
                    {dirs && (
                      <a href={dirs.google} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded bg-gray-100 text-gray-800 text-xs font-medium">
                        Itinéraire
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
