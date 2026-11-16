import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { backfillGeocoding } from '../services/geocodingService';
import { needsGeocoding } from '../services/geoUtils';

// Localisation automatique, en arrière-plan, des bons qui ont une adresse
// mais pas encore de coordonnées (bons créés avant la géolocalisation, ou
// géocodeur indisponible au moment de l'enregistrement).
//   - idempotent : un bon n'est tenté qu'une fois par session ; un échec
//     définitif (adresse introuvable) est mémorisé en base (geocoded_at)
//   - séquentiel et poli (5 req/s), ~10 s pour 50 bons
//   - `onDone` : recharger les bons (silencieusement) une fois terminé
// Retourne la progression { done, total, ok, failed, errors, finished } ou null.
export default function useAutoGeocode(orders, { enabled = true, onDone } = {}) {
  const [progress, setProgress] = useState(null);
  const runningRef = useRef(false);
  const attemptedRef = useRef(new Set());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!enabled || runningRef.current) return;
    const todo = (orders || []).filter((o) => needsGeocoding(o) && !attemptedRef.current.has(o.id));
    if (todo.length === 0) return;
    todo.forEach((o) => attemptedRef.current.add(o.id));
    runningRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        setProgress({ done: 0, total: todo.length, ok: 0, failed: 0, errors: 0 });
        const stats = await backfillGeocoding(todo, {
          update: async (id, patch) => {
            const { error } = await supabase.from('menuiserie_orders').update(patch).eq('id', id);
            if (error) throw error;
          },
          onProgress: (p) => { if (!cancelled) setProgress(p); },
          shouldStop: () => cancelled,
        });
        if (!cancelled) setProgress({ ...stats, finished: true });
        onDoneRef.current?.();
      } catch (e) {
        console.error('Localisation automatique :', e);
        if (!cancelled) setProgress((p) => ({ ...(p || {}), finished: true, errors: (p?.errors || 0) + 1 }));
      } finally {
        runningRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [orders, enabled]);

  return progress;
}
