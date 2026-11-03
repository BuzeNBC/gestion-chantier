// Distances, rayons, couleurs de marqueurs : pur JS, sans dépendance.
import { orderRelances, computeOrderStatus, orderInterventions } from './menuiserieService';

export const RADIUS_OPTIONS = [1, 2, 3, 4, 5];
export const DEFAULT_RADIUS_KM = 3;

// Fond de carte. Constante unique pour pouvoir changer de fournisseur sans
// toucher aux composants (OSM par défaut ; IGN Plan v2 ou MapTiler en secours).
export const TILE_LAYER = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
};

export const hasCoords = (o) =>
  o != null && o.latitude !== null && o.longitude !== null
  && Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude));

export const coordsOf = (o) => (hasCoords(o) ? { lat: Number(o.latitude), lng: Number(o.longitude) } : null);

// Distance à vol d'oiseau (km). Largement suffisant pour « à moins de 5 km ».
export const haversineKm = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// Bons localisés dans le rayon, triés du plus proche au plus loin,
// chacun enrichi de `distanceKm`.
export const ordersWithin = (orders, center, radiusKm) => {
  if (!center) return [];
  return (orders || [])
    .filter(hasCoords)
    .map((o) => ({ ...o, distanceKm: haversineKm(center, coordsOf(o)) }))
    .filter((o) => o.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
};

export const distanceLabel = (km) => {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
};

// Code couleur des marqueurs, cohérent avec les listes :
// rouge urgent, orange relancé, bleu normal, gris clos (terminé / annulé).
export const MARKER_COLORS = { urgent: '#dc2626', relance: '#f97316', normal: '#2563eb', closed: '#9ca3af' };
export const markerKind = (o) => {
  if (o?.cancelled || computeOrderStatus(orderInterventions(o)) === 'completed') return 'closed';
  if (o?.is_urgent) return 'urgent';
  if (orderRelances(o).length > 0) return 'relance';
  return 'normal';
};
export const markerColor = (o) => MARKER_COLORS[markerKind(o)];

// Un bon a une adresse mais n'a jamais été géocodé POUR CETTE adresse.
export const needsGeocoding = (o) =>
  !!(o?.address && String(o.address).trim()) && !hasCoords(o)
  && String(o.geocode_address || '') !== String(o.address).trim();
// Déjà tenté pour cette adresse, sans succès.
export const geocodingFailed = (o) =>
  !!(o?.address && String(o.address).trim()) && !hasCoords(o)
  && String(o.geocode_address || '') === String(o.address).trim();
