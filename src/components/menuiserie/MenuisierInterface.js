import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MapPin, Phone, User, Ruler, Camera, CheckCircle,
  Clock, Save, Trash2, ChevronRight, LogOut, FileText, X,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MENUISERIE_STATUS_STYLES, MENUISERIE_PHOTO_CATEGORIES,
  typeLabel, statusLabel,
} from '../../services/menuiserieService';
import { generateMenuiseriePdf, openOrDownloadPdf } from '../../services/menuiseriePdf';
import PhotoUploadButton from '../PhotoUploadButton';
import MeasurementsEditor from './MeasurementsEditor';

function MenuisierInterface() {
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  // Champs éditables du bon en cours
  const [measurements, setMeasurements] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('todo');
  const [photoCategory, setPhotoCategory] = useState('avant');

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('menuiserie_orders')
        .select('*')
        .eq('assigned_to', user.id)
        .order('scheduled_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Erreur chargement bons menuiserie:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openOrder = (order) => {
    setSelected(order);
    setMeasurements(order.measurements || []);
    setPhotos(order.photos || []);
    setNotes(order.notes || '');
    setStatus(order.status || 'todo');
  };

  const closeOrder = () => {
    setSelected(null);
  };

  const handlePhotoSelected = (url, id) => {
    setPhotos((prev) => [...prev, { id, url, category: photoCategory }]);
  };

  const removePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const persist = async (overrides = {}) => {
    if (!selected) return;
    const payload = {
      measurements,
      photos,
      notes,
      status,
      ...overrides,
    };
    // Si on passe en terminé, on date la réalisation ; sinon on l'efface
    if (payload.status === 'completed') {
      payload.completed_date = new Date().toISOString().slice(0, 10);
    } else {
      payload.completed_date = null;
    }

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('menuiserie_orders')
        .update(payload)
        .eq('id', selected.id);
      if (error) throw error;

      const updated = { ...selected, ...payload };
      setSelected(updated);
      setStatus(payload.status);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (error) {
      console.error('Erreur enregistrement bon:', error);
      alert("Erreur lors de l'enregistrement. Réessayez.");
    } finally {
      setIsSaving(false);
    }
  };

  // Génère le rapport PDF du bon (avec cotes, photos, notes) et l'ouvre.
  // On enregistre d'abord les modifs non sauvées pour qu'elles soient incluses.
  const handleGeneratePdf = async () => {
    if (!selected || pdfGenerating) return;
    try {
      setPdfGenerating(true);
      // Snapshot du bon avec les valeurs courantes du formulaire
      const snapshot = { ...selected, measurements, photos, notes, status };
      const { url, blob } = await generateMenuiseriePdf(snapshot);
      const slug = (selected.client_name || 'bon').toLowerCase().replace(/\s+/g, '-');
      openOrDownloadPdf({ url, blob }, `bon-menuiserie-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Erreur génération PDF menuiserie :', error);
      alert('Erreur lors de la génération du PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ---------------------------------------------------------------- LISTE
  if (!selected) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">Mes interventions menuiserie</h1>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
          {orders.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Aucune intervention ne vous est assignée pour le moment.
            </div>
          )}

          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => openOrder(order)}
              className="w-full bg-white rounded-lg shadow p-4 flex items-center justify-between text-left hover:shadow-md transition-shadow"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">
                    {order.client_name || 'Client non renseigné'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[order.status] || ''}`}>
                    {statusLabel(order.status)}
                  </span>
                </div>
                <p className="text-sm text-blue-600">{typeLabel(order.type)}</p>
                {order.address && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {order.address}
                  </p>
                )}
                {order.scheduled_date && (
                  <p className="text-xs text-gray-400">
                    Prévu le {new Date(order.scheduled_date).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------- DÉTAIL
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={closeOrder} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-800">{selected.client_name || 'Intervention'}</h1>
            <p className="text-sm text-blue-600">{typeLabel(selected.type)}</p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[status] || ''}`}>
            {statusLabel(status)}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Infos client (lecture seule) */}
        <section className="bg-white rounded-lg shadow p-5 space-y-2">
          <h2 className="font-semibold text-gray-800 mb-2">Détails</h2>
          {selected.client_name && (
            <p className="text-sm flex items-center gap-2 text-gray-700">
              <User className="h-4 w-4 text-gray-400" /> {selected.client_name}
            </p>
          )}
          {selected.client_phone && (
            <p className="text-sm flex items-center gap-2 text-gray-700">
              <Phone className="h-4 w-4 text-gray-400" /> {selected.client_phone}
            </p>
          )}
          {selected.address && (
            <p className="text-sm flex items-center gap-2 text-gray-700">
              <MapPin className="h-4 w-4 text-gray-400" /> {selected.address}
            </p>
          )}
          {(selected.charge_affaire || selected.bt_number) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 pt-2 border-t mt-2">
              {selected.charge_affaire && (
                <span><span className="text-gray-500">CA :</span> {selected.charge_affaire}</span>
              )}
              {selected.bt_number && (
                <span><span className="text-gray-500">N° de BT :</span> {selected.bt_number}</span>
              )}
            </div>
          )}
          {selected.description && (
            <p className="text-sm text-gray-600 pt-2 border-t mt-2">{selected.description}</p>
          )}
        </section>

        {/* Cotes */}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Ruler className="h-4 w-4 text-gray-400" /> Prise de cote
          </h2>
          <MeasurementsEditor measurements={measurements} onChange={setMeasurements} />
        </section>

        {/* Photos */}
        <section className="bg-white rounded-lg shadow p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Camera className="h-4 w-4 text-gray-400" /> Photos
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={photoCategory}
              onChange={(e) => setPhotoCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {Object.entries(MENUISERIE_PHOTO_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <PhotoUploadButton
              onFileSelected={handlePhotoSelected}
              siteId={selected.id}
              taskId={photoCategory}
            />
          </div>

          {photos.length > 0 && (
            // Comme dans le mode ouvrier : on n'affiche PAS les miniatures
            // inline (économise la bande passante mobile et accélère le
            // rendu de la page). L'utilisateur clique sur le lien pour
            // visualiser la photo dans une modale.
            <div className="flex flex-wrap gap-x-3 gap-y-2 pt-1">
              {photos.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => setPreviewPhotoUrl(p.url)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Photo {idx + 1}
                    <span className="ml-1 text-xs text-gray-400">
                      ({MENUISERIE_PHOTO_CATEGORIES[p.category] || p.category})
                    </span>
                  </button>
                  <button
                    onClick={() => removePhoto(p.id)}
                    className="text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Retirer la photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Notes */}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-2">Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Observations, matériel à prévoir, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* Actions */}
        <section className="bg-white rounded-lg shadow p-5 space-y-3">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => persist({ status: 'in_progress' })}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Clock className="h-4 w-4" /> Marquer en cours
            </button>
            <button
              onClick={() => persist({ status: 'completed' })}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" /> Marquer terminé
            </button>
          </div>
          <button
            onClick={() => persist()}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
          <button
            onClick={handleGeneratePdf}
            disabled={pdfGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {pdfGenerating ? 'Génération en cours…' : 'Générer le rapport PDF'}
          </button>
        </section>
      </main>

      {/* Modale d'aperçu d'une photo (clic sur un lien "Photo N") */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewPhotoUrl(null); }}
            className="absolute top-4 right-4 text-white hover:text-gray-200"
            aria-label="Fermer"
          >
            <X className="h-7 w-7" />
          </button>
          <img
            src={previewPhotoUrl}
            alt="Aperçu"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default MenuisierInterface;
