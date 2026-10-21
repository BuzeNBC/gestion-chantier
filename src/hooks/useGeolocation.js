import { useState, useCallback } from 'react';

// Position de l'utilisateur, demandée uniquement sur action (tap sur un
// bouton) : meilleure acceptation de la permission, surtout sur iOS.
// Nécessite HTTPS (Vercel) ou localhost.
export default function useGeolocation() {
  const [state, setState] = useState({ status: 'idle', position: null, error: null });

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'error', position: null, error: 'Géolocalisation non disponible sur cet appareil.' });
      return;
    }
    setState((s) => ({ ...s, status: 'loading', error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({
        status: 'ok',
        position: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
        error: null,
      }),
      (err) => setState({
        status: err.code === 1 ? 'denied' : 'error',
        position: null,
        error: err.code === 1
          ? 'Position refusée. Autorise la localisation (Réglages > Safari/Chrome > Position) ou touche la carte pour choisir un point.'
          : 'Position introuvable. Réessaie, ou touche la carte pour choisir un point.',
      }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  return { ...state, request };
}
