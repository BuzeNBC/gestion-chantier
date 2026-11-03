import React, { useState } from 'react';
import { Calendar, Camera, Ruler, Trash2, Save, Check, Clock, Circle } from 'lucide-react';
import Modal from './MenuiserieModal';
import MeasurementsEditor from './MeasurementsEditor';
import PhotoUploadButton from '../PhotoUploadButton';
import PhotoLightbox from './PhotoLightbox';
import { supabase } from '../../services/supabase';
import {
  MENUISERIE_STATUS, MENUISERIE_PHOTO_CATEGORIES, orderInterventions, computeOrderStatus,
} from '../../services/menuiserieService';
import { describeDbError } from '../../services/dbErrors';

// Édition complète d'une intervention depuis l'admin (ce que fait le
// menuisier depuis son téléphone) : intitulé, état, date d'intervention,
// notes / ouvrages réalisés, cotes, photos. Écrit le tableau `interventions`
// du bon et recalcule son statut global.
//   onSaved(updatedOrder) reçoit le bon mis à jour.
const STATUS_ICONS = { todo: Circle, in_progress: Clock, completed: Check };
const STATUS_STYLES = {
  todo: 'bg-gray-700 text-white border-gray-700',
  in_progress: 'bg-blue-600 text-white border-blue-600',
  completed: 'bg-green-600 text-white border-green-600',
};

export default function InterventionEditModal({ order, intervention, onSaved, onClose }) {
  const [draft, setDraft] = useState(() => ({
    ...intervention,
    type: intervention.type || '',
    status: intervention.status || 'todo',
    intervention_date: intervention.intervention_date || '',
    notes: intervention.notes || '',
    measurements: intervention.measurements || [],
    photos: intervention.photos || [],
  }));
  const [photoCategory, setPhotoCategory] = useState('apres');
  const [lightbox, setLightbox] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  const addPhoto = (url, id) => {
    setDraft((d) => ({ ...d, photos: [...(d.photos || []), { id, url, category: photoCategory }] }));
  };
  const removePhoto = (id) => setDraft((d) => ({ ...d, photos: (d.photos || []).filter((p) => p.id !== id) }));

  const save = async () => {
    if (!draft.type.trim()) {
      alert("L'intitulé de l'intervention est obligatoire.");
      return;
    }
    try {
      setSaving(true);
      const { _legacy, ...clean } = draft; // eslint-disable-line no-unused-vars
      const merged = {
        ...clean,
        type: draft.type.trim(),
        intervention_date: draft.intervention_date || null,
      };
      // Même règle que côté menuisier : date de réalisation posée au passage
      // en « terminé », retirée sinon.
      if (merged.status === 'completed' && !merged.completed_date) {
        merged.completed_date = new Date().toISOString().slice(0, 10);
      } else if (merged.status !== 'completed') {
        merged.completed_date = null;
      }
      const interventions = orderInterventions(order).map((iv) => {
        const { _legacy: l, ...rest } = iv; // eslint-disable-line no-unused-vars
        return rest.id === merged.id ? merged : rest;
      });
      const status = computeOrderStatus(interventions);
      const { error } = await supabase
        .from('menuiserie_orders')
        .update({ interventions, status })
        .eq('id', order.id);
      if (error) throw error;
      onSaved?.({ ...order, interventions, status });
    } catch (e) {
      console.error("Erreur enregistrement de l'intervention :", e);
      alert(`Erreur lors de l'enregistrement — ${describeDbError(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Intervention — ${order.client_name || 'bon'}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Intitulé *</label>
          <input
            type="text"
            value={draft.type}
            onChange={(e) => set('type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Ex: Réparation volet roulant"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">État</label>
            <div className="flex gap-2">
              {Object.entries(MENUISERIE_STATUS).map(([value, label]) => {
                const Icon = STATUS_ICONS[value] || Circle;
                const active = draft.status === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('status', value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-sm font-medium ${
                      active ? STATUS_STYLES[value] : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" /> Date d'intervention
            </label>
            <input
              type="date"
              value={draft.intervention_date || ''}
              onChange={(e) => set('intervention_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Reprise dans le rapport PDF.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes / ouvrages réalisés</label>
          <textarea
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Travaux effectués, observations, matériel à prévoir…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
            <Ruler className="h-4 w-4 text-gray-400" /> Cotes
          </label>
          <MeasurementsEditor
            measurements={draft.measurements}
            onChange={(m) => set('measurements', m)}
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-gray-400" /> Photos ({(draft.photos || []).length})
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={photoCategory}
              onChange={(e) => setPhotoCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {Object.entries(MENUISERIE_PHOTO_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <PhotoUploadButton onFileSelected={addPhoto} siteId={order.id} taskId={draft.id} multiple />
          </div>
          {(draft.photos || []).length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {draft.photos.map((p, idx) => (
                <div key={p.id} className="relative group">
                  <button type="button" onClick={() => setLightbox(idx)} className="block w-full">
                    <img src={p.url} alt={p.category} className="w-full h-24 object-cover rounded-lg" />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {MENUISERIE_PHOTO_CATEGORIES[p.category] || p.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-red-600 shadow opacity-0 group-hover:opacity-100 focus:opacity-100"
                    aria-label="Retirer la photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100">
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {lightbox !== null && (
        <PhotoLightbox
          photos={draft.photos}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </Modal>
  );
}
