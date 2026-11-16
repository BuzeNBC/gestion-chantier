import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

// Rafraîchissement multi-utilisateurs de la table menuiserie_orders :
//   - Supabase Realtime (postgres_changes) -> `onChange` débouncé ;
//   - retour au premier plan (visibilitychange) -> `onChange` ;
//   - repli : polling toutes les `pollMs` si le canal n'est pas SUBSCRIBED
//     (table absente de la publication, websocket coupé…).
// `onChange` doit recharger SANS spinner (loadData({ silent: true })).
export default function useOrdersRealtime({ enabled = true, onChange, debounceMs = 300, pollMs = 60000 } = {}) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    let subscribed = false;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => cbRef.current?.(), debounceMs);
    };

    // Nom unique : plusieurs composants peuvent s'abonner en même temps.
    const channel = supabase
      .channel(`menuiserie_orders_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menuiserie_orders' }, fire)
      .subscribe((status) => {
        subscribed = status === 'SUBSCRIBED';
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') fire();
    };
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(() => {
      if (!subscribed) fire();
    }, pollMs);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [enabled, debounceMs, pollMs]);
}
