import { supabase } from './supabase';

// Journal des appels passés depuis l'app (colonne jsonb `call_log`).
// On note la tentative d'appel (on ne peut pas savoir si le client a décroché).
export const orderCalls = (order) => (Array.isArray(order?.call_log) ? order.call_log : []);

export const lastCall = (order) => {
  const calls = orderCalls(order);
  if (calls.length === 0) return null;
  return [...calls].sort((a, b) => (b.at || '').localeCompare(a.at || ''))[0];
};

// « Appelé le 21/10 à 14:32 (Franck) »
export const callLabel = (call) => {
  if (!call?.at) return '';
  const d = new Date(call.at);
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `Appelé le ${date} à ${time}${call.by_name ? ` (${call.by_name})` : ''}`;
};

// Ajoute une entrée et l'enregistre (on garde les 30 derniers appels).
export const logCall = async (order, { userId = null, byName = null } = {}) => {
  const entry = {
    id: typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `c-${Date.now()}`,
    at: new Date().toISOString(),
    by: userId,
    by_name: byName,
  };
  const next = [...orderCalls(order), entry].slice(-30);
  const { error } = await supabase
    .from('menuiserie_orders')
    .update({ call_log: next })
    .eq('id', order.id);
  if (error) throw error;
  return next;
};
