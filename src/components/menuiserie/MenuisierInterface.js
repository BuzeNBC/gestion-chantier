import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MapPin, Phone, User, Ruler, Camera, CheckCircle,
  Clock, Save, Trash2, ChevronRight, LogOut, FileText, X, Plus,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MENUISERIE_STATUS_STYLES, MENUISERIE_PHOTO_CATEGORIES,
  typeLabel, statusLabel, computeOrderStatus, orderInterventions, newIntervention,
  findMenuiserieTrade,
} from '../../services/menuiserieService';
import { generateMenuiseriePdf, openOrDownloadPdf } from '../../services/menuiseriePdf';
import PhotoUploadButton from '../PhotoUploadButton';
import MeasurementsEditor from './MeasurementsEditor';
import AttachmentsEditor from './AttachmentsEditor';

// Props :
// - embedded (default false) : si true, n'affiche pas le header de page
//   (titre + bouton Déconnexion) parce que le composant est rendu à l'intérieur
//   du layout AdminDashboard (sidebar déjà présente avec son propre logout).
// - showAllBons (default false) : si true, charge TOUS les bons de menuiserie
//   au lieu de filtrer par assigned_to = user.id. Utilisé pour les ouvriers
//   qui ont accès en lecture/écriture à tous les bons pour coordination.
function MenuisierInterface({ embedded = false, showAllBons = false } = {}) {
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState([]);
  const [interventionOptions, setInterventionOptions] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedIvId, setSelectedIvId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  // État d'édition de l'intervention en cours (clone local pour saisie)
  const [draftIv, setDraftIv] = useState(null);
  const [photoCategory, setPhotoCategory] = useState('avant');
  // Mode ajout d'une nouvelle intervention sur place
  const [addMode, setAddMode] = useState(false);
  const [addType, setAddType] = useState('');
  const [addCustomMode, setAddCustomMode] = useState(false);
  const [addCustomText, setAddCustomText] = useState('');

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      let query = supabase
        .from('menuiserie_orders')
        .select('*')
        .order('scheduled_date', { ascending: true, nullsFirst: false });
      if (!showAllBons) {
        query = query.eq('assigned_to', user.id);
      }
      const [ordersRes, tradesRes] = await Promise.all([
        query,
        supabase.from('trades').select('*'),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (tradesRes.error) throw tradesRes.error;
      setOrders(ordersRes.data || []);
      const trade = findMenuiserieTrade(tradesRes.data || []);
      setInterventionOptions(trade?.tasks || []);
    } catch (error) {
      console.error('Erreur chargement bons menuiserie:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, showAllBons]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ouvre une intervention pour édition : on clone localement pour ne pas
  // perdre les modifications non sauvegardées si on revient en arrière.
  const openIntervention = (iv) => {
    setSelectedIvId(iv.id);
    setDraftIv({
      ...iv,
      measurements: iv.measurements || [],
      photos: iv.photos || [],
      notes: iv.notes || '',
    });
  };

  const closeIntervention = () => {
    setSelectedIvId(null);
    setDraftIv(null);
    setAddMode(false);
  };

  const closeOrder = () => {
    setSelectedOrderId(null);
    closeIntervention();
  };

  // Sauvegarde la draft intervention dans le bon (et applique éventuellement
  // un nouveau statut). Retourne le bon mis à jour.
  const persistDraft = async (overrides = {}) => {
    if (!selectedOrder || !draftIv) return;
    const merged = { ...draftIv, ...overrides };
    if (merged.status === 'completed' && !merged.completed_date) {
      merged.completed_date = new Date().toISOString().slice(0, 10);
    } else if (merged.status !== 'completed') {
      merged.completed_date = null;
    }
    const updatedInterventions = (selectedOrder.interventions || []).map((iv) =>
      iv.id === merged.id ? merged : iv
    );
    const aggStatus = computeOrderStatus(updatedInterventions);
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('menuiserie_orders')
        .update({
          interventions: updatedInterventions,
          status: aggStatus,
        })
        .eq('id', selectedOrder.id);
      if (error) throw error;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrder.id
            ? { ...o, interventions: updatedInterventions, status: aggStatus }
            : o
        )
      );
      setDraftIv(merged);
    } catch (error) {
      console.error('Erreur enregistrement intervention :', error);
      alert("Erreur lors de l'enregistrement. Réessayez.");
    } finally {
      setIsSaving(false);
    }
  };

  // Ajoute une nouvelle intervention au bon (depuis l'interface menuisier).
  const addInterventionToOrder = async () => {
    if (!selectedOrder) return;
    const t = (addCustomMode ? addCustomText : addType).trim();
    if (!t) {
      alert("Choisis un type d'intervention.");
      return;
    }
    const created = newIntervention(t, user?.id);
    const updated = [...(selectedOrder.interventions || []), created];
    const aggStatus = computeOrderStatus(updated);
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('menuiserie_orders')
        .update({ interventions: updated, status: aggStatus })
        .eq('id', selectedOrder.id);
      if (error) throw error;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrder.id ? { ...o, interventions: updated, status: aggStatus } : o
        )
      );
      setAddMode(false);
      setAddType('');
      setAddCustomMode(false);
      setAddCustomText('');
    } catch (error) {
      console.error('Erreur ajout intervention :', error);
      alert("Erreur lors de l'ajout de l'intervention.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!selectedOrder || pdfGenerating) return;
    try {
      setPdfGenerating(true);
      // On utilise le bon tel qu'il est dans `orders` (donc avec la dernière
      // version sauvegardée des interventions).
      const { url, blob } = await generateMenuiseriePdf(selectedOrder);
      const slug = (selectedOrder.client_name || 'bon').toLowerCase().replace(/\s+/g, '-');
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

  // ============================================================ LISTE DES BONS
  if (!selectedOrder) {
    return (
      <div className={embedded ? 'bg-gray-100' : 'min-h-screen bg-gray-100'}>
        {!embedded && (
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
        )}
        {embedded && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <h2 className="text-lg font-semibold text-gray-700">
              {showAllBons ? 'Tous les bons de menuiserie' : 'Mes interventions menuiserie'}
            </h2>
          </div>
        )}

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
          {orders.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Aucune intervention ne vous est assignée pour le moment.
            </div>
          )}

          {orders.map((order) => {
            const ivs = orderInterventions(order);
            const aggStatus = computeOrderStatus(ivs);
            const done = ivs.filter((i) => i.status === 'completed').length;
            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className="w-full bg-white rounded-lg shadow p-4 flex items-center justify-between text-left hover:shadow-md transition-shadow"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">
                      {order.client_name || 'Client non renseigné'}
                    </span>
                    {order.bt_number && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">BT {order.bt_number}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[aggStatus] || ''}`}>
                      {statusLabel(aggStatus)}
                    </span>
                  </div>
                  <p className="text-sm text-blue-600">
                    {ivs.length} intervention{ivs.length > 1 ? 's' : ''} · {done}/{ivs.length} terminée{done > 1 ? 's' : ''}
                  </p>
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
            );
          })}
        </main>
      </div>
    );
  }

  // ============================================================ ÉDITION D'UNE INTERVENTION
  if (selectedIvId && draftIv) {
    const handlePhotoSelected = (url, id) => {
      setDraftIv((d) => ({ ...d, photos: [...(d.photos || []), { id, url, category: photoCategory }] }));
    };
    const removePhoto = (id) => {
      setDraftIv((d) => ({ ...d, photos: (d.photos || []).filter((p) => p.id !== id) }));
    };

    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <button onClick={closeIntervention} className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <p className="text-xs text-gray-500">{selectedOrder.client_name || 'Bon'}</p>
              <h1 className="text-base font-bold text-gray-800">{typeLabel(draftIv.type)}</h1>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[draftIv.status] || ''}`}>
              {statusLabel(draftIv.status)}
            </span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Cotes */}
          <section className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Ruler className="h-4 w-4 text-gray-400" /> Prise de cote
            </h2>
            <MeasurementsEditor
              measurements={draftIv.measurements}
              onChange={(m) => setDraftIv((d) => ({ ...d, measurements: m }))}
            />
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
                siteId={selectedOrder.id}
                taskId={draftIv.id}
              />
            </div>
            {(draftIv.photos || []).length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-2 pt-1">
                {draftIv.photos.map((p, idx) => (
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
              value={draftIv.notes}
              onChange={(e) => setDraftIv((d) => ({ ...d, notes: e.target.value }))}
              rows={3}
              placeholder="Observations, matériel à prévoir, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </section>

          {/* Actions */}
          <section className="bg-white rounded-lg shadow p-5 space-y-3">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => persistDraft({ status: 'in_progress' })}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Clock className="h-4 w-4" /> Marquer en cours
              </button>
              <button
                onClick={() => persistDraft({ status: 'completed' })}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" /> Marquer terminé
              </button>
            </div>
            <button
              onClick={() => persistDraft()}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </section>
        </main>

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

  // ============================================================ DÉTAIL D'UN BON
  const ivs = orderInterventions(selectedOrder);
  const aggStatus = computeOrderStatus(ivs);
  const addChoices = addType && !interventionOptions.includes(addType)
    ? [addType, ...interventionOptions]
    : interventionOptions;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={closeOrder} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-800">{selectedOrder.client_name || 'Bon'}</h1>
            <p className="text-xs text-gray-500">
              {ivs.filter((i) => i.status === 'completed').length}/{ivs.length} terminée{ivs.length > 1 ? 's' : ''}
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[aggStatus] || ''}`}>
            {statusLabel(aggStatus)}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Infos client (lecture seule) */}
        <section className="bg-white rounded-lg shadow p-5 space-y-2">
          <h2 className="font-semibold text-gray-800 mb-2">Détails</h2>
          {selectedOrder.client_name && (
            <p className="text-sm flex items-center gap-2 text-gray-700">
              <User className="h-4 w-4 text-gray-400" /> {selectedOrder.client_name}
            </p>
          )}
          {selectedOrder.client_phone && (
            <p className="text-sm flex items-center gap-2 text-gray-700">
              <Phone className="h-4 w-4 text-gray-400" /> {selectedOrder.client_phone}
            </p>
          )}
          {selectedOrder.address && (
            <p className="text-sm flex items-center gap-2 text-gray-700">
              <MapPin className="h-4 w-4 text-gray-400" /> {selectedOrder.address}
            </p>
          )}
          {(selectedOrder.charge_affaire || selectedOrder.bt_number) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 pt-2 border-t mt-2">
              {selectedOrder.charge_affaire && (
                <span><span className="text-gray-500">CA :</span> {selectedOrder.charge_affaire}</span>
              )}
              {selectedOrder.bt_number && (
                <span><span className="text-gray-500">N° de BT :</span> {selectedOrder.bt_number}</span>
              )}
            </div>
          )}
          {selectedOrder.description && (
            <p className="text-sm text-gray-600 pt-2 border-t mt-2">{selectedOrder.description}</p>
          )}
        </section>

        {/* Pièces jointes envoyées par l'admin (PDF, plans, photos brutes…) */}
        {(selectedOrder.attachments || []).length > 0 && (
          <section className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-3">
              Documents fournis ({selectedOrder.attachments.length})
            </h2>
            <AttachmentsEditor
              attachments={selectedOrder.attachments}
              onChange={() => {}}
              orderId={selectedOrder.id}
              readOnly
            />
          </section>
        )}

        {/* Liste des interventions */}
        <section className="space-y-3">
          <h2 className="font-semibold text-gray-800">Interventions à effectuer</h2>
          {ivs.length === 0 && (
            <p className="text-sm text-gray-400 italic">Aucune intervention pour ce bon.</p>
          )}
          {ivs.map((iv, idx) => (
            <button
              key={iv.id}
              onClick={() => openIntervention(iv)}
              className="w-full bg-white rounded-lg shadow p-4 flex items-center justify-between text-left hover:shadow-md transition-shadow"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">#{idx + 1}</span>
                  <span className="font-medium text-gray-800">{typeLabel(iv.type)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[iv.status] || ''}`}>
                    {statusLabel(iv.status)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {(iv.measurements || []).length} cote{(iv.measurements || []).length > 1 ? 's' : ''} ·
                  {' '}{(iv.photos || []).length} photo{(iv.photos || []).length > 1 ? 's' : ''}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
            </button>
          ))}

          {/* Bouton + formulaire d'ajout d'une intervention */}
          {!addMode ? (
            <button
              onClick={() => setAddMode(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-blue-600 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" /> Ajouter une intervention
            </button>
          ) : (
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-700">Nouvelle intervention</h3>
                {addChoices.length > 0 && (
                  <label className="text-xs text-gray-600 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={addCustomMode}
                      onChange={(e) => setAddCustomMode(e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    Nouveau type
                  </label>
                )}
              </div>
              {addCustomMode || addChoices.length === 0 ? (
                <input
                  type="text"
                  value={addCustomText}
                  onChange={(e) => setAddCustomText(e.target.value)}
                  placeholder="Décris l'intervention"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              ) : (
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">— Choisir un type —</option>
                  {addChoices.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setAddMode(false); setAddType(''); setAddCustomMode(false); setAddCustomText(''); }}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={addInterventionToOrder}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}
        </section>

        {/* PDF */}
        <section className="bg-white rounded-lg shadow p-5">
          <button
            onClick={handleGeneratePdf}
            disabled={pdfGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {pdfGenerating ? 'Génération en cours…' : 'Générer le rapport PDF du bon'}
          </button>
        </section>
      </main>
    </div>
  );
}

export default MenuisierInterface;
