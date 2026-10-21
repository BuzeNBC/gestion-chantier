// Géocodage des adresses via l'API Adresse (Base Adresse Nationale) :
// gratuite, sans clé, CORS ouvert, excellente sur les adresses françaises.
// L'endpoint historique migre vers la Géoplateforme IGN (même format) : on
// essaie dans l'ordre et on bascule en cas d'erreur réseau / HTTP >= 500.
export const GEOCODER_ENDPOINTS = [
  'https://api-adresse.data.gouv.fr/search/',
  'https://data.geopf.fr/geocodage/search',
];

// Biais géographique : métropole lilloise (les résultats proches remontent).
export const LILLE_CENTER = { lat: 50.6292, lng: 3.0573 };

const TIMEOUT_MS = 4000;

const parseFeature = (f) => ({
  label: f.properties?.label || '',
  lat: f.geometry?.coordinates?.[1],
  lng: f.geometry?.coordinates?.[0],
  score: Number(f.properties?.score) || 0,
  type: f.properties?.type || '',
  postcode: f.properties?.postcode || '',
  city: f.properties?.city || '',
  street: f.properties?.street || '',
  housenumber: f.properties?.housenumber || '',
});

// Requête brute avec repli d'endpoint. Lève une erreur réseau si aucun
// endpoint ne répond (à distinguer d'un « aucun résultat », qui renvoie []).
const query = async (q, { limit = 5, autocomplete = 1, signal } = {}) => {
  const params = new URLSearchParams({
    q, limit: String(limit), autocomplete: String(autocomplete),
    lat: String(LILLE_CENTER.lat), lon: String(LILLE_CENTER.lng),
  });
  let lastError = null;
  for (const base of GEOCODER_ENDPOINTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onOuterAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onOuterAbort);
    try {
      const res = await fetch(`${base}?${params.toString()}`, { signal: ctrl.signal });
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return []; // 4xx = requête invalide (ex. trop courte) -> rien
      const json = await res.json();
      return (json.features || []).map(parseFeature).filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
    } catch (e) {
      if (signal?.aborted) throw e; // annulation volontaire (nouvelle frappe)
      lastError = e;                 // timeout / réseau / 5xx -> endpoint suivant
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onOuterAbort);
    }
  }
  throw lastError || new Error('Géocodeur indisponible');
};

// Autocomplétion (à la frappe)
export const searchAddress = (q, opts = {}) => query(q, { ...opts, autocomplete: 1 });

// Géocodage strict d'une adresse complète : le meilleur candidat, seulement
// s'il est fiable (score >= 0.5, précision rue/numéro/lieu-dit). `null` sinon.
export const geocodeOne = async (address) => {
  const q = String(address || '').trim();
  if (q.length < 3) return null;
  const hits = await query(q, { limit: 1, autocomplete: 0 });
  const best = hits[0];
  if (!best) return null;
  if (best.score < 0.5) return null;
  if (!['housenumber', 'street', 'locality'].includes(best.type)) return null;
  return best;
};

// Patches à écrire sur le bon
export const geocodePatch = (hit, address) => ({
  latitude: hit.lat,
  longitude: hit.lng,
  geocode_label: hit.label,
  geocode_score: hit.score,
  geocode_address: address,
  geocode_source: 'ban',
  geocoded_at: new Date().toISOString(),
});
export const geocodeFailPatch = (address) => ({
  latitude: null,
  longitude: null,
  geocode_label: null,
  geocode_score: null,
  geocode_address: address,
  geocode_source: null,
  geocoded_at: new Date().toISOString(),
});
export const geocodeClearPatch = () => ({
  latitude: null, longitude: null, geocode_label: null, geocode_score: null,
  geocode_address: null, geocode_source: null, geocoded_at: null,
});

// Rétro-géocodage séquentiel (5 req/s max : poli vis-à-vis du service).
// update(orderId, patch) écrit en base ; onProgress(stats) suit l'avancement.
// Les erreurs sont classées : 'geocoder' (réseau / service) ou 'db'
// (écriture refusée, ex. migration 0016 non appliquée). Après 3 erreurs
// consécutives on s'arrête (stats.aborted) : inutile d'insister, et le
// message de la dernière erreur (stats.lastError) explique quoi corriger.
export const backfillGeocoding = async (orders, { update, onProgress, shouldStop, delayMs = 200 } = {}) => {
  const stats = {
    done: 0, total: orders.length, ok: 0, failed: 0, errors: 0,
    lastError: null, lastErrorSource: null, aborted: false,
  };
  let consecutiveErrors = 0;
  for (const order of orders) {
    if (shouldStop?.()) break;
    const address = String(order.address || '').trim();
    let hit = null;
    let source = 'geocoder';
    try {
      hit = await geocodeOne(address);
      source = 'db';
      await update(order.id, hit ? geocodePatch(hit, address) : geocodeFailPatch(address));
      if (hit) stats.ok += 1; else stats.failed += 1;
      consecutiveErrors = 0;
    } catch (e) {
      console.warn('Géocodage impossible pour', order.id, '(' + source + ')', e);
      stats.errors += 1;
      stats.lastError = e?.message || String(e);
      stats.lastErrorSource = source;
      consecutiveErrors += 1;
    }
    stats.done += 1;
    onProgress?.({ ...stats });
    if (consecutiveErrors >= 3) {
      stats.aborted = true;
      onProgress?.({ ...stats });
      break;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return stats;
};
