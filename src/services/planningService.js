// Helpers du planning menuiserie (heure de rendez-vous, durée, conflits,
// conversion bon <-> événement de calendrier). Pur JS, sans dépendance.
//
// Règle d'or : toutes les dates/heures sont des « heures murales » locales
// (Europe/Paris). On ne passe JAMAIS par toISOString() pour fabriquer une
// date ou une heure : ça bascule en UTC et décale le rendez-vous d'1 à 2 h.
import { typeLabel, orderInterventions, computeOrderStatus } from './menuiserieService';

export const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240, 480];
export const DEFAULT_DURATION = 120;
export const PLANNING_HOURS = { min: '07:00:00', max: '19:00:00' };
export const HIDDEN_DAYS = [0]; // dimanche

// Couleurs attribuées aux menuisiers (index = position dans la liste triée)
export const MENUISIER_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777'];
export const UNASSIGNED_COLOR = '#6b7280';

export const pad2 = (n) => String(n).padStart(2, '0');
export const toLocalDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const toLocalTimeStr = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const todayStr = () => toLocalDateStr(new Date());

// '09:30:00' -> '09:30' (Postgres renvoie les secondes)
export const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
export const timeToMinutes = (t) => {
  const [h, m] = hhmm(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const minutesToTime = (min) => `${pad2(Math.floor(min / 60) % 24)}:${pad2(((min % 60) + 60) % 60)}`;
export const addMinutesToTime = (t, delta) => minutesToTime(timeToMinutes(t) + delta);

export const durationLabel = (min) => {
  const m = Number(min) || 0;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${pad2(r)}` : `${h} h`;
};

// Date locale sûre depuis 'YYYY-MM-DD' (sans passer par l'UTC)
export const parseLocalDate = (dateStr) => (dateStr ? new Date(`${dateStr}T00:00:00`) : null);

// « mar. 21/10 à 09:30 (2 h) » / « mar. 21/10 (journée) » / null si non planifié
export const scheduledLabel = (order, { withDuration = true, withWeekday = true } = {}) => {
  if (!order?.scheduled_date) return null;
  const d = parseLocalDate(order.scheduled_date);
  const dateTxt = d.toLocaleDateString('fr-FR', {
    ...(withWeekday ? { weekday: 'short' } : {}), day: '2-digit', month: '2-digit',
  });
  if (!order.scheduled_time) return `${dateTxt} (journée)`;
  const dur = withDuration && order.duration_minutes ? ` (${durationLabel(order.duration_minutes)})` : '';
  return `${dateTxt} à ${hhmm(order.scheduled_time)}${dur}`;
};

// Un bon est planifiable tant qu'il n'est ni annulé ni terminé.
export const isPlannable = (o) =>
  !o?.cancelled && computeOrderStatus(orderInterventions(o)) !== 'completed';

// Couleur stable d'un menuisier (liste triée par nom) ; gris si non assigné.
export const colorForMenuisier = (menuisierId, menuisiers = []) => {
  if (!menuisierId) return UNASSIGNED_COLOR;
  const sorted = [...menuisiers].sort((a, b) => (a.Name || '').localeCompare(b.Name || '', 'fr'));
  const idx = sorted.findIndex((m) => m.id === menuisierId);
  return idx === -1 ? UNASSIGNED_COLOR : MENUISIER_COLORS[idx % MENUISIER_COLORS.length];
};

export const initials = (name) =>
  String(name || '?').split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();

// Intervalle [début, fin) en minutes d'un bon planifié à l'heure (null si journée)
const timedInterval = (o) => {
  if (!o?.scheduled_date || !o.scheduled_time) return null;
  const start = timeToMinutes(o.scheduled_time);
  return [start, start + (Number(o.duration_minutes) || DEFAULT_DURATION)];
};

// Bons du même menuisier, le même jour, dont le créneau chevauche celui de
// `candidate` (les rendez-vous « journée » ne créent jamais de conflit).
export const conflictsFor = (candidate, orders = []) => {
  const iv = timedInterval(candidate);
  if (!iv || !candidate.assigned_to) return [];
  return orders.filter((o) => {
    if (o.id === candidate.id) return false;
    if (o.assigned_to !== candidate.assigned_to) return false;
    if (o.scheduled_date !== candidate.scheduled_date) return false;
    if (!isPlannable(o)) return false;
    const ov = timedInterval(o);
    return ov && iv[0] < ov[1] && ov[0] < iv[1];
  });
};

// Map<orderId, Order[]> des chevauchements, pour tout le planning.
export const findConflicts = (orders = []) => {
  const map = new Map();
  for (const o of orders) {
    const c = conflictsFor(o, orders);
    if (c.length > 0) map.set(o.id, c);
  }
  return map;
};

// Bon -> événement FullCalendar. `start` sans « Z » = heure locale.
export const orderToEvent = (o, { colorOf, conflicts, done = false, selected = false } = {}) => {
  const allDay = !o.scheduled_time;
  const start = allDay ? o.scheduled_date : `${o.scheduled_date}T${hhmm(o.scheduled_time)}:00`;
  const end = allDay
    ? undefined
    : new Date(new Date(start).getTime() + (Number(o.duration_minutes) || DEFAULT_DURATION) * 60000);
  const color = colorOf ? colorOf(o.assigned_to) : UNASSIGNED_COLOR;
  const ivs = orderInterventions(o);
  const title = `${o.client_name || 'Client'} — ${ivs[0] ? typeLabel(ivs[0].type) : 'Menuiserie'}`;
  return {
    id: o.id,
    title,
    start,
    end,
    allDay,
    backgroundColor: color,
    borderColor: color,
    classNames: [
      o.is_urgent && 'fc-urgent',
      conflicts?.has?.(o.id) && 'fc-conflict',
      done && 'fc-done',
      selected && 'fc-selected',
    ].filter(Boolean),
    extendedProps: { order: o },
  };
};

// Événement FullCalendar (après drag/drop/resize) -> patch partiel pour la base.
export const eventToPatch = (ev) => {
  const patch = {
    scheduled_date: toLocalDateStr(ev.start),
    scheduled_time: ev.allDay ? null : toLocalTimeStr(ev.start),
  };
  if (!ev.allDay && ev.end) {
    patch.duration_minutes = Math.max(15, Math.round((ev.end - ev.start) / 60000));
  }
  return patch;
};
