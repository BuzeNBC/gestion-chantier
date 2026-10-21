import React, { useState } from 'react';
import { Calendar, Clock, AlertTriangle, CalendarX } from 'lucide-react';
import Modal from './MenuiserieModal';
import {
  DURATION_OPTIONS, DEFAULT_DURATION, conflictsFor, hhmm, durationLabel, todayStr,
} from '../../services/planningService';

// Modal « Planifier / Modifier l'horaire » d'un bon — le flux principal sur
// téléphone (admin comme menuisier) : date, journée entière ou heure + durée,
// menuisier. Avertit (sans bloquer) si le créneau chevauche un autre RDV du
// même menuisier. `onSave(patch)` reçoit un patch partiel pour la base.
//
// `defaults` permet de préremplir (ex. « bons proches à planifier » : même
// jour, heure = fin du RDV précédent, même menuisier).
const ScheduleModal = ({
  order,
  orders = [],
  menuisiers = [],
  canChangeAssignee = true,
  defaults = {},
  onSave,
  onClose,
  onOpenOrder,
}) => {
  const [date, setDate] = useState(order.scheduled_date || defaults.date || todayStr());
  const [allDay, setAllDay] = useState(order.scheduled_date ? !order.scheduled_time : !defaults.time);
  const [time, setTime] = useState(hhmm(order.scheduled_time) || defaults.time || '09:00');
  const [duration, setDuration] = useState(order.duration_minutes || defaults.duration || DEFAULT_DURATION);
  const [assignee, setAssignee] = useState(order.assigned_to || defaults.assignee || '');
  const [saving, setSaving] = useState(false);

  const candidate = {
    ...order,
    scheduled_date: date,
    scheduled_time: allDay ? null : time,
    duration_minutes: Number(duration) || DEFAULT_DURATION,
    assigned_to: assignee || null,
  };
  const conflicts = conflictsFor(candidate, orders);
  const nameOf = (id) => menuisiers.find((m) => m.id === id)?.Name || null;

  const submit = async (patch) => {
    try {
      setSaving(true);
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!date) {
      alert('Renseigne la date du rendez-vous.');
      return;
    }
    if (!allDay && !time) {
      alert("Renseigne l'heure, ou coche « Journée entière ».");
      return;
    }
    submit({
      scheduled_date: date,
      scheduled_time: allDay ? null : time,
      duration_minutes: Number(duration) || DEFAULT_DURATION,
      ...(canChangeAssignee ? { assigned_to: assignee || null } : {}),
    });
  };

  const unschedule = () => {
    if (!window.confirm('Retirer ce bon du planning (il restera dans la liste, sans date) ?')) return;
    submit({ scheduled_date: null, scheduled_time: null });
  };

  const durations = DURATION_OPTIONS.includes(Number(duration))
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, Number(duration)].sort((a, b) => a - b);

  return (
    <Modal title={`Rendez-vous — ${order.client_name || 'bon'}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {order.address ? <p className="text-sm text-gray-500">{order.address}</p> : <span />}
          {onOpenOrder && (
            <button onClick={onOpenOrder} className="text-sm text-blue-600 hover:underline">
              Voir le bon complet
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-gray-400" /> Date *
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          Journée entière (pas d'heure précise)
        </label>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gray-400" /> Heure *
              </label>
              <input
                type="time"
                step="900"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Durée</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base bg-white"
              >
                {durations.map((d) => (
                  <option key={d} value={d}>{durationLabel(d)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {canChangeAssignee && menuisiers.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Menuisier</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base bg-white"
            >
              <option value="">— Non assigné —</option>
              {menuisiers.map((m) => (
                <option key={m.id} value={m.id}>{m.Name || m.id}</option>
              ))}
            </select>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Chevauche un autre rendez-vous{nameOf(assignee) ? ` de ${nameOf(assignee)}` : ''} :</p>
              <ul className="list-disc list-inside">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    {c.client_name || 'Client'} — {hhmm(c.scheduled_time)} ({durationLabel(c.duration_minutes || DEFAULT_DURATION)})
                  </li>
                ))}
              </ul>
              <p className="text-xs mt-1">Tu peux quand même enregistrer.</p>
            </div>
          </div>
        )}

        {order.planning_updated_at && (
          <p className="text-xs text-gray-500">
            Dernière modification du planning
            {nameOf(order.planning_updated_by) ? ` par ${nameOf(order.planning_updated_by)}` : ''}
            {' '}le {new Date(order.planning_updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
          {order.scheduled_date ? (
            <button
              onClick={unschedule}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <CalendarX className="h-4 w-4" /> Retirer du planning
            </button>
          ) : <span />}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100">
              Annuler
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ScheduleModal;
