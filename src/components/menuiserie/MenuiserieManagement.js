import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  Plus, Edit, Trash, X, Search, Eye, MapPin, User, Calendar, FileText, Download,
  Euro, Bell, AlertTriangle, Inbox,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { DBService, STORES, generateUUID } from '../../services/dbService';
import {
  MENUISERIE_STATUS, MENUISERIE_STATUS_STYLES,
  MENUISERIE_PHOTO_CATEGORIES, typeLabel, statusLabel, findMenuiserieTrade,
  newIntervention, computeOrderStatus, orderInterventions,
  BILLING_STATUS, BILLING_STATUS_STYLES, billingLabel,
  isOrderBillable, effectiveBillingStatus,
  MENUISERIE_CATEGORIES, orderCategory, categoryLabel, compareOrders, orderReceivedDate,
  sortInterventionOptions,
  relanceBadgeStyle, relanceBorderStyle, orderRelances, newRelance,
  orderTotalHt, fmtEuro,
} from '../../services/menuiserieService';
import { generateMenuiseriePdf, openOrDownloadPdf } from '../../services/menuiseriePdf';
import { exportMonthCsv, exportMonthPdf, monthLabel } from '../../services/menuiserieExport';
import MeasurementsEditor from './MeasurementsEditor';
import InterventionLinesEditor from './InterventionLinesEditor';
import AttachmentsEditor from './AttachmentsEditor';

const Modal = memo(({ title, onClose, children, wide = false }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className={`bg-white p-6 rounded-lg shadow-lg w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-6 w-6" />
        </button>
      </div>
      {children}
    </div>
  </div>
));

const emptyForm = {
  client_name: '',
  client_phone: '',
  address: '',
  description: '',
  assigned_to: '',
  scheduled_date: '',
  reference: '',
  bt_number: '',
  charge_affaire: '',
  is_urgent: false,
  received_date: '',
};

// Construit les `interventionLines` initiales du formulaire à partir d'un bon
// existant (édition) ou retourne une ligne vide (création).
const initialLinesFromOrder = (order) => {
  const existing = orderInterventions(order);
  if (existing.length === 0) {
    return [{ lineId: 'l-init', type: '', customMode: false, customText: '' }];
  }
  return existing.map((iv) => ({
    lineId: 'l-' + iv.id,
    type: iv.type || '',
    customMode: false,
    customText: '',
    // Garde la référence à l'intervention existante (avec ses cotes/photos/etc)
    // pour la repasser intacte côté parent au submit.
    existing: iv,
  }));
};

// `interventionOptions` = les tâches du corps d'état « Menuiserie ».
// `chargeAffaireOptions` = liste des chargé(e)s d'affaire (table charge_affaires).
const OrderForm = ({ order, menuisiers, interventionOptions, chargeAffaireOptions, defaultCategory, onSubmit, onCancel }) => {
  const [form, setForm] = useState(order ? {
    client_name: order.client_name || '',
    client_phone: order.client_phone || '',
    address: order.address || '',
    description: order.description || '',
    assigned_to: order.assigned_to || '',
    scheduled_date: order.scheduled_date || '',
    reference: order.reference || '',
    bt_number: order.bt_number || '',
    charge_affaire: order.charge_affaire || '',
    category: orderCategory(order),
    is_urgent: !!order.is_urgent,
    received_date: order.received_date || '',
  } : {
    ...emptyForm,
    category: defaultCategory || 'petites_interventions',
    // Par défaut, le bon est reçu aujourd'hui.
    received_date: new Date().toISOString().slice(0, 10),
  });
  // Liste éditable d'interventions (cf. InterventionLinesEditor).
  const [interventionLines, setInterventionLines] = useState(() => initialLinesFromOrder(order));
  // Chargé d'affaire : possibilité d'en ajouter un nouveau.
  const [customCAMode, setCustomCAMode] = useState(false);
  const [customCA, setCustomCA] = useState('');
  // Pièces jointes (PDF, images, docs…). Pour un nouveau bon on génère l'id
  // upfront pour pouvoir uploader dans Storage avant la création de la ligne SQL.
  const [attachments, setAttachments] = useState(order?.attachments || []);
  const [formOrderId] = useState(() => order?.id || generateUUID());

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // Même logique pour le chargé d'affaire (préservation à l'édition).
  const caChoices = form.charge_affaire && !chargeAffaireOptions.includes(form.charge_affaire)
    ? [form.charge_affaire, ...chargeAffaireOptions]
    : chargeAffaireOptions;

  const submit = () => {
    if (!form.client_name.trim()) {
      alert('Le nom du client est obligatoire.');
      return;
    }
    // Construire les interventions à partir des lignes
    const interventions = [];
    const newTaskTypes = [];
    for (const line of interventionLines) {
      const t = (line.customMode ? line.customText : line.type).trim();
      if (!t) continue;
      if (line.existing) {
        // Édition d'une intervention déjà existante : on garde tout, on met juste à jour le type
        interventions.push({ ...line.existing, type: t });
      } else {
        interventions.push(newIntervention(t));
      }
      if (line.customMode && !interventionOptions.includes(t) && !newTaskTypes.includes(t)) {
        newTaskTypes.push(t);
      }
    }
    if (interventions.length === 0) {
      alert("Ajoute au moins une intervention.");
      return;
    }
    const effectiveCA = customCAMode ? customCA.trim() : form.charge_affaire.trim();
    onSubmit({
      ...form,
      interventions,
      attachments,
      charge_affaire: effectiveCA || null,
      assigned_to: form.assigned_to || null,
      scheduled_date: form.scheduled_date || null,
      received_date: form.received_date || null,
      reference: form.reference || null,
      bt_number: form.bt_number || null,
      // Tâches à ajouter au corps d'état Menuiserie
      _customTypesToPersist: newTaskTypes,
      _customCAToPersist: customCAMode && effectiveCA && !chargeAffaireOptions.includes(effectiveCA) ? effectiveCA : null,
      // L'id pré-généré pour les uploads dans Storage. handleCreate l'utilisera.
      _preGeneratedId: formOrderId,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Client *</label>
          <input
            type="text"
            value={form.client_name}
            onChange={(e) => set('client_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Nom du client"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Téléphone</label>
          <input
            type="tel"
            value={form.client_phone}
            onChange={(e) => set('client_phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="06 12 34 56 78"
          />
        </div>
      </div>

      <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer ${
        form.is_urgent ? 'bg-red-50 border-red-300' : 'bg-white border-gray-300 hover:bg-gray-50'
      }`}>
        <input
          type="checkbox"
          checked={form.is_urgent}
          onChange={(e) => set('is_urgent', e.target.checked)}
          className="h-4 w-4 text-red-600 border-gray-300 rounded"
        />
        <AlertTriangle className={`h-4 w-4 ${form.is_urgent ? 'text-red-600' : 'text-gray-400'}`} />
        <span className={`text-sm font-medium ${form.is_urgent ? 'text-red-700' : 'text-gray-700'}`}>
          Chantier urgent — remonte en rouge tout en haut de la liste
        </span>
      </label>

      <div>
        <label className="block text-sm font-medium mb-1">Adresse du chantier</label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="12 rue des Lilas, 59000 Lille"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="Détail de l'intervention demandée"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Menuisier assigné</label>
          <select
            value={form.assigned_to}
            onChange={(e) => set('assigned_to', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">— Non assigné —</option>
            {menuisiers.map((m) => (
              <option key={m.id} value={m.id}>{m.Name || m.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date prévue</label>
          <input
            type="date"
            value={form.scheduled_date || ''}
            onChange={(e) => set('scheduled_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date de réception du bon</label>
          <input
            type="date"
            value={form.received_date || ''}
            onChange={(e) => set('received_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">Sert au tri : le plus ancien reçu passe en premier.</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium">Chargé(e) d'affaire</label>
          {caChoices.length > 0 && (
            <label className="text-xs text-gray-600 flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={customCAMode}
                onChange={(e) => {
                  setCustomCAMode(e.target.checked);
                  if (!e.target.checked) setCustomCA('');
                }}
                className="h-3.5 w-3.5"
              />
              Nouveau chargé d'affaire
            </label>
          )}
        </div>
        {customCAMode || caChoices.length === 0 ? (
          <>
            <input
              type="text"
              value={customCAMode ? customCA : form.charge_affaire}
              onChange={(e) => (customCAMode ? setCustomCA(e.target.value) : set('charge_affaire', e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Prénom Nom"
            />
            {customCAMode && (
              <p className="text-xs text-blue-600 mt-1">
                Ce chargé d'affaire sera ajouté à la liste pour les prochains bons.
              </p>
            )}
          </>
        ) : (
          <select
            value={form.charge_affaire}
            onChange={(e) => set('charge_affaire', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">— Non renseigné —</option>
            {caChoices.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">N° de BT</label>
          <input
            type="text"
            value={form.bt_number}
            onChange={(e) => set('bt_number', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Référence demande du bon de commande"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Référence (optionnel)</label>
          <input
            type="text"
            value={form.reference}
            onChange={(e) => set('reference', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Ex: BM-2026-001"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sous-section</label>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            {Object.entries(MENUISERIE_CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Interventions *</label>
        <InterventionLinesEditor
          lines={interventionLines}
          onChange={setInterventionLines}
          interventionOptions={interventionOptions}
        />
        <p className="text-xs text-gray-500 mt-2">
          Ajoute toutes les interventions à effectuer à cette adresse. Le menuisier
          renseignera les cotes, photos et statut pour chacune indépendamment.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Pièces jointes</label>
        <AttachmentsEditor
          attachments={attachments}
          onChange={setAttachments}
          orderId={formOrderId}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100">
          Annuler
        </button>
        <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {order ? 'Enregistrer' : 'Créer le bon'}
        </button>
      </div>
    </div>
  );
};

// Formulaire « Facturation » : la secrétaire renseigne le prix HT de chaque
// intervention, le statut (à facturer / devis envoyé / facturé), le n° de
// devis/facture et la date. Le total se calcule tout seul.
const BillingForm = ({ order, onSaved, onCancel }) => {
  const interventions = orderInterventions(order);
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(interventions.map((iv) => [iv.id, iv.price_ht ?? '']))
  );
  const [billingStatus, setBillingStatus] = useState(() => {
    const s = order.billing_status || 'devis_a_faire';
    if (s === 'devis_envoye') return 'devis_fait'; // ancienne valeur (avant 0008)
    return BILLING_STATUS[s] ? s : 'devis_a_faire';
  });
  const [invoiceNumber, setInvoiceNumber] = useState(order.invoice_number || '');
  const [billedDate, setBilledDate] = useState(order.billed_date || '');
  const [saving, setSaving] = useState(false);

  const total = interventions.reduce((sum, iv) => {
    const p = Number(String(prices[iv.id]).replace(',', '.'));
    return sum + (Number.isFinite(p) ? p : 0);
  }, 0);

  const save = async () => {
    try {
      setSaving(true);
      // Réinjecte les prix dans les interventions (sans toucher au reste :
      // cotes, photos, statut… restent intacts).
      const updatedInterventions = interventions.map((iv) => {
        const raw = String(prices[iv.id] ?? '').replace(',', '.').trim();
        const p = raw === '' ? null : Number(raw);
        const { _legacy, ...rest } = iv; // eslint-disable-line no-unused-vars
        return { ...rest, price_ht: Number.isFinite(p) ? p : null };
      });
      const { error } = await supabase
        .from('menuiserie_orders')
        .update({
          interventions: updatedInterventions,
          billing_status: billingStatus,
          invoice_number: invoiceNumber.trim() || null,
          billed_date: billedDate || null,
        })
        .eq('id', order.id);
      if (error) throw error;
      onSaved();
    } catch (e) {
      console.error('Erreur sauvegarde facturation :', e);
      alert('Erreur lors de la sauvegarde de la facturation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!isOrderBillable(order) && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Ce bon n'est pas terminé : il apparaîtra automatiquement « Devis à faire »
          quand toutes ses interventions seront terminées. Tu peux quand même
          renseigner les prix dès maintenant.
        </p>
      )}
      <div>
        <label className="block text-sm font-medium mb-2">Prix HT par intervention</label>
        {interventions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucune intervention sur ce bon.</p>
        ) : (
          <div className="space-y-2">
            {interventions.map((iv) => (
              <div key={iv.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0 text-sm">
                  <span className="text-gray-800">{typeLabel(iv.type)}</span>{' '}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${MENUISERIE_STATUS_STYLES[iv.status] || ''}`}>
                    {statusLabel(iv.status)}
                  </span>
                </div>
                <div className="relative w-32 flex-shrink-0">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={prices[iv.id]}
                    onChange={(e) => setPrices((p) => ({ ...p, [iv.id]: e.target.value }))}
                    className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded-lg text-right"
                    placeholder="0,00"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t text-sm">
              <span className="font-medium text-gray-700">Total HT</span>
              <span className="font-bold text-gray-900">{fmtEuro(total)}</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Étape devis / facturation</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(BILLING_STATUS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setBillingStatus(value)}
              className={`px-3 py-2 rounded-lg text-sm border ${
                billingStatus === value
                  ? `${BILLING_STATUS_STYLES[value]} border-transparent font-semibold ring-2 ring-offset-1 ring-blue-400`
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Parcours : Devis à faire → Devis fait → À facturer → Facturé.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">N° devis / facture</label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Ex: F-2026-042"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date de facturation</label>
          <input
            type="date"
            value={billedDate}
            onChange={(e) => setBilledDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100">
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
  );
};

// Formulaire « Relances » : historique des relances reçues pour ce bon
// (date + note), avec ajout et suppression. Le nombre de relances pilote la
// couleur du badge et la remontée du bon en haut de la liste.
const RelancesForm = ({ order, onSaved, onCancel }) => {
  const [relances, setRelances] = useState(() => orderRelances(order));
  const [draft, setDraft] = useState(() => newRelance());
  const [saving, setSaving] = useState(false);

  const addDraft = () => {
    if (!draft.date) {
      alert('Renseigne la date de la relance.');
      return;
    }
    setRelances((r) => [...r, { ...draft, note: draft.note.trim() }]);
    setDraft(newRelance());
  };

  const removeRelance = (id) => setRelances((r) => r.filter((x) => x.id !== id));

  const save = async () => {
    try {
      setSaving(true);
      // Si une relance est en cours de saisie (note remplie) mais pas encore
      // « Ajoutée », on l'inclut quand même pour éviter de la perdre.
      const pending = draft.note.trim() ? [{ ...draft, note: draft.note.trim() }] : [];
      const { error } = await supabase
        .from('menuiserie_orders')
        .update({ relances: [...relances, ...pending] })
        .eq('id', order.id);
      if (error) throw error;
      onSaved();
    } catch (e) {
      console.error('Erreur sauvegarde relances :', e);
      alert('Erreur lors de la sauvegarde des relances.');
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...relances].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <div className="space-y-4">
      {sorted.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Relances enregistrées</label>
            <span className={`px-2 py-0.5 rounded-full text-xs ${relanceBadgeStyle(sorted.length)}`}>
              {sorted.length} relance{sorted.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {sorted.map((r, idx) => (
              <div key={r.id} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${relanceBadgeStyle(idx + 1)}`}>
                  #{idx + 1}
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="text-gray-800 font-medium">
                    {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : 'Date inconnue'}
                  </p>
                  {r.note && <p className="text-gray-600 whitespace-pre-wrap">{r.note}</p>}
                </div>
                <button
                  onClick={() => removeRelance(r.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  aria-label="Supprimer la relance"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-3">
        <label className="block text-sm font-medium">Nouvelle relance</label>
        <div className="flex gap-3">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="text"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Qui a relancé, par quel moyen, quoi…"
          />
        </div>
        <button
          onClick={addDraft}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
        >
          <Plus className="h-4 w-4" /> Ajouter la relance
        </button>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100">
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
  );
};

const OrderDetail = ({ order }) => {
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const handleGeneratePdf = async () => {
    if (pdfGenerating) return;
    try {
      setPdfGenerating(true);
      const { url, blob } = await generateMenuiseriePdf(order);
      const slug = (order.client_name || 'bon').toLowerCase().replace(/\s+/g, '-');
      openOrDownloadPdf({ url, blob }, `bon-menuiserie-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error('Erreur génération PDF menuiserie :', e);
      alert('Erreur lors de la génération du PDF.');
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={handleGeneratePdf}
          disabled={pdfGenerating}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          {pdfGenerating ? 'Génération…' : 'Rapport PDF'}
        </button>
      </div>
    {order.is_urgent && (
      <p className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-semibold text-red-700">
        <AlertTriangle className="h-4 w-4" /> Chantier urgent
      </p>
    )}
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <span className="text-gray-500">Statut :</span>{' '}
        <span className={`px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[computeOrderStatus(orderInterventions(order))] || ''}`}>
          {statusLabel(computeOrderStatus(orderInterventions(order)))}
        </span>
      </div>
      {order.client_phone && <div><span className="text-gray-500">Tél :</span> {order.client_phone}</div>}
      {order.address && <div className="col-span-2"><span className="text-gray-500">Adresse :</span> {order.address}</div>}
      {order.charge_affaire && (
        <div><span className="text-gray-500">Chargé d'affaire :</span> {order.charge_affaire}</div>
      )}
      {order.bt_number && (
        <div><span className="text-gray-500">N° de BT :</span> {order.bt_number}</div>
      )}
      {order.scheduled_date && (
        <div><span className="text-gray-500">Prévu :</span> {new Date(order.scheduled_date).toLocaleDateString('fr-FR')}</div>
      )}
      {orderReceivedDate(order) && (
        <div><span className="text-gray-500">Reçu le :</span> {new Date(orderReceivedDate(order)).toLocaleDateString('fr-FR')}</div>
      )}
      <div>
        <span className="text-gray-500">Facturation :</span>{' '}
        {effectiveBillingStatus(order) ? (
          <>
            <span className={`px-2 py-0.5 rounded-full text-xs ${BILLING_STATUS_STYLES[effectiveBillingStatus(order)]}`}>
              {billingLabel(effectiveBillingStatus(order))}
            </span>
            {order.invoice_number && <span className="ml-2 text-xs text-gray-500">N° {order.invoice_number}</span>}
            {order.billed_date && (
              <span className="ml-2 text-xs text-gray-500">le {new Date(order.billed_date).toLocaleDateString('fr-FR')}</span>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-400 italic">bon non terminé</span>
        )}
      </div>
      {orderTotalHt(order) > 0 && (
        <div><span className="text-gray-500">Total HT :</span> <span className="font-semibold">{fmtEuro(orderTotalHt(order))}</span></div>
      )}
    </div>

    {orderRelances(order).length > 0 && (
      <div>
        <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
          Relances
          <span className={`px-2 py-0.5 rounded-full text-xs ${relanceBadgeStyle(orderRelances(order).length)}`}>
            {orderRelances(order).length}
          </span>
        </h3>
        <ul className="space-y-1 text-sm text-gray-600">
          {[...orderRelances(order)]
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
            .map((r, idx) => (
              <li key={r.id}>
                <span className="font-medium">#{idx + 1}</span>{' '}
                — {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : 'date inconnue'}
                {r.note && <span className="text-gray-500"> : {r.note}</span>}
              </li>
            ))}
        </ul>
      </div>
    )}

    {order.description && (
      <div>
        <h3 className="font-medium text-gray-700 mb-1">Description</h3>
        <p className="text-sm text-gray-600">{order.description}</p>
      </div>
    )}

    {(order.attachments || []).length > 0 && (
      <div>
        <h3 className="font-medium text-gray-700 mb-2">Pièces jointes ({order.attachments.length})</h3>
        <AttachmentsEditor attachments={order.attachments} onChange={() => {}} orderId={order.id} readOnly />
      </div>
    )}

    <div className="space-y-4">
      <h3 className="font-medium text-gray-700">Interventions ({orderInterventions(order).length})</h3>
      {orderInterventions(order).map((iv, idx) => (
        <div key={iv.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              <span className="text-gray-500">#{idx + 1} —</span>{' '}
              <span className="font-medium text-blue-700">{typeLabel(iv.type)}</span>
            </div>
            <div className="flex items-center gap-2">
              {Number.isFinite(Number(iv.price_ht)) && iv.price_ht !== null && iv.price_ht !== '' && (
                <span className="text-sm font-semibold text-gray-800">{fmtEuro(iv.price_ht)}</span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[iv.status] || ''}`}>
                {statusLabel(iv.status)}
              </span>
            </div>
          </div>
          {iv.intervention_date && (
            <p className="text-xs text-gray-600 font-medium">
              Date d'intervention : {new Date(iv.intervention_date).toLocaleDateString('fr-FR')}
            </p>
          )}
          {iv.completed_date && (
            <p className="text-xs text-gray-500">Réalisé le {new Date(iv.completed_date).toLocaleDateString('fr-FR')}</p>
          )}
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-1">Cotes</h4>
            <MeasurementsEditor measurements={iv.measurements || []} onChange={() => {}} readOnly />
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-1">Photos</h4>
            {(iv.photos || []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucune photo.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {iv.photos.map((p) => (
                  <div key={p.id} className="relative">
                    <img src={p.url} alt={p.category} className="w-full h-28 object-cover rounded-lg" />
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                      {MENUISERIE_PHOTO_CATEGORIES[p.category] || p.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {iv.notes && (
            <div>
              <h4 className="text-xs font-medium text-gray-600 mb-1">Notes du menuisier</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{iv.notes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
    </div>
  );
};

function MenuiserieManagement() {
  const [orders, setOrders] = useState([]);
  const [menuisiers, setMenuisiers] = useState([]);
  const [interventionOptions, setInterventionOptions] = useState([]);
  const [chargeAffaireOptions, setChargeAffaireOptions] = useState([]);
  // On garde la référence au corps d'état Menuiserie pour pouvoir y persister
  // une nouvelle tâche créée à la volée depuis le formulaire de bon.
  const [menuiserieTrade, setMenuiserieTrade] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState({ type: null, data: null });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [billingFilter, setBillingFilter] = useState('all');
  // Sous-section active (onglet) : petites interventions / commande de portes
  const [category, setCategory] = useState('petites_interventions');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [ordersRes, menuisiersRes, tradesRes, caRes] = await Promise.all([
        supabase
          .from('menuiserie_orders')
          .select('*, assigned_profile:assigned_to(id, Name)')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, Name, role').eq('role', 'menuisier'),
        supabase.from('trades').select('*'),
        supabase.from('charge_affaires').select('name').order('name', { ascending: true }),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (menuisiersRes.error) throw menuisiersRes.error;
      if (tradesRes.error) throw tradesRes.error;
      if (caRes.error) throw caRes.error;

      setOrders(ordersRes.data || []);
      setMenuisiers(menuisiersRes.data || []);
      setChargeAffaireOptions((caRes.data || []).map((r) => r.name));

      // Les types d'intervention proviennent des tâches du corps d'état « Menuiserie »
      const trade = findMenuiserieTrade(tradesRes.data || []);
      setMenuiserieTrade(trade);
      setInterventionOptions(sortInterventionOptions(trade?.tasks || []));
    } catch (error) {
      console.error('Erreur chargement menuiserie:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Persiste de nouvelles tâches dans le corps d'état Menuiserie pour qu'elles
  // soient disponibles dans la liste déroulante des prochains bons.
  const persistCustomTasksIfAny = async (customTasks) => {
    const tasks = Array.isArray(customTasks) ? customTasks : (customTasks ? [customTasks] : []);
    const toAdd = tasks.filter(Boolean);
    if (toAdd.length === 0) return;
    if (!menuiserieTrade) {
      console.warn('Aucun corps d\'état Menuiserie trouvé — tâches custom non sauvées.');
      return;
    }
    const existing = new Set(menuiserieTrade.tasks || []);
    const additions = toAdd.filter((t) => !existing.has(t));
    if (additions.length === 0) return;
    try {
      const updatedTrade = {
        ...menuiserieTrade,
        tasks: [...(menuiserieTrade.tasks || []), ...additions],
        updated_at: new Date().toISOString(),
      };
      await DBService.store(STORES.TRADES, updatedTrade);
    } catch (e) {
      console.error('Erreur ajout tâches au corps d\'état:', e);
    }
  };

  // Persiste un nouveau chargé d'affaire pour qu'il apparaisse dans la liste
  // déroulante des prochains bons.
  const persistCustomCAIfAny = async (customCA) => {
    if (!customCA) return;
    if (chargeAffaireOptions.includes(customCA)) return;
    try {
      const { error } = await supabase.from('charge_affaires').insert({ name: customCA });
      if (error && error.code !== '23505') throw error; // 23505 = unique violation
    } catch (e) {
      console.error('Erreur ajout chargé d\'affaire :', e);
    }
  };

  const handleCreate = async (formData) => {
    try {
      const { _customTypesToPersist, _customCAToPersist, _preGeneratedId, ...orderFields } = formData;
      const newOrder = {
        ...orderFields,
        // Important : on utilise l'id pré-généré au moment de l'ouverture du
        // formulaire pour que les pièces jointes (déjà uploadées dans Storage
        // sous ce préfixe) restent cohérentes avec l'id du bon.
        id: _preGeneratedId || generateUUID(),
        status: computeOrderStatus(orderFields.interventions),
        measurements: [],
        photos: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await DBService.store(STORES.MENUISERIE, newOrder);
      await persistCustomTasksIfAny(_customTypesToPersist);
      await persistCustomCAIfAny(_customCAToPersist);
      setModal({ type: null });
      loadData();
    } catch (error) {
      console.error('Erreur création bon:', error);
      alert("Erreur lors de la création du bon.");
    }
  };

  const handleEdit = async (formData) => {
    try {
      const { assigned_profile, ...rest } = modal.data; // eslint-disable-line no-unused-vars
      const { _customTypesToPersist, _customCAToPersist, _preGeneratedId, ...orderFields } = formData; // eslint-disable-line no-unused-vars
      const updated = {
        ...rest,
        ...orderFields,
        status: computeOrderStatus(orderFields.interventions),
        updated_at: new Date().toISOString(),
      };
      await DBService.store(STORES.MENUISERIE, updated);
      await persistCustomTasksIfAny(_customTypesToPersist);
      await persistCustomCAIfAny(_customCAToPersist);
      setModal({ type: null });
      loadData();
    } catch (error) {
      console.error('Erreur modification bon:', error);
      alert("Erreur lors de la modification du bon.");
    }
  };

  // Bascule rapide du marquage « urgent » depuis la liste.
  const toggleUrgent = async (order) => {
    try {
      const next = !order.is_urgent;
      const { error } = await supabase
        .from('menuiserie_orders')
        .update({ is_urgent: next })
        .eq('id', order.id);
      if (error) throw error;
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, is_urgent: next } : o)));
    } catch (error) {
      console.error('Erreur marquage urgent:', error);
      alert("Erreur lors du marquage urgent.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer définitivement ce bon de menuiserie ?')) return;
    try {
      await DBService.delete(STORES.MENUISERIE, id);
      loadData();
    } catch (error) {
      console.error('Erreur suppression bon:', error);
      alert("Erreur lors de la suppression du bon.");
    }
  };

  // Bons de la sous-section active : tout le reste (stats, filtres, export)
  // travaille sur cette liste. Les bons terminés quittent leur sous-section
  // pour rejoindre l'onglet « Terminés » (toutes catégories confondues).
  const isCompleted = (o) => computeOrderStatus(orderInterventions(o)) === 'completed';
  const categoryOrders = orders.filter((o) =>
    category === 'termines'
      ? isCompleted(o)
      : orderCategory(o) === category && !isCompleted(o)
  );

  const filtered = categoryOrders.filter((o) => {
    const term = search.toLowerCase();
    const ivs = orderInterventions(o);
    const matchesSearch =
      !term ||
      (o.client_name || '').toLowerCase().includes(term) ||
      (o.address || '').toLowerCase().includes(term) ||
      (o.reference || '').toLowerCase().includes(term) ||
      (o.bt_number || '').toLowerCase().includes(term);
    const aggStatus = computeOrderStatus(ivs);
    const matchesStatus = statusFilter === 'all' || aggStatus === statusFilter;
    // Le filtre type matche si N'IMPORTE QUELLE intervention du bon a ce type.
    const matchesType = typeFilter === 'all' || ivs.some((iv) => iv.type === typeFilter);
    // Le statut de facturation « effectif » : un bon non terminé n'est pas
    // « à facturer » (c'est une consigne pour la secrétaire, pas un défaut).
    const effBilling = effectiveBillingStatus(o);
    const matchesBilling =
      billingFilter === 'all' ||
      (billingFilter === 'relances'
        ? orderRelances(o).length > 0
        : billingFilter === 'pending'
          ? effBilling !== null && effBilling !== 'facture'
          : effBilling === billingFilter);
    return matchesSearch && matchesStatus && matchesType && matchesBilling;
  });

  // Tri partagé avec l'interface menuisier (cf. compareOrders) :
  // urgents > relances > date prévue > date de création.
  const sortedOrders = [...filtered].sort(compareOrders);

  const stats = categoryOrders.reduce(
    (acc, o) => {
      const s = computeOrderStatus(orderInterventions(o));
      acc.total++;
      if (s === 'todo') acc.todo++;
      else if (s === 'in_progress') acc.inProgress++;
      else if (s === 'completed') acc.completed++;
      // « À traiter » = bons entrés dans le parcours devis/facture, pas encore facturés
      const eff = effectiveBillingStatus(o);
      if (eff !== null && eff !== 'facture') acc.aTraiter++;
      if (orderRelances(o).length > 0) acc.relances++;
      return acc;
    },
    { total: 0, todo: 0, inProgress: 0, completed: 0, aTraiter: 0, relances: 0 },
  );

  // Options du filtre « type » : tâches du corps d'état + types présents dans
  // les interventions des bons (au cas où une tâche aurait été renommée/supprimée).
  const typeFilterOptions = sortInterventionOptions(Array.from(
    new Set([
      ...interventionOptions,
      ...categoryOrders.flatMap((o) => orderInterventions(o).map((iv) => iv.type)).filter(Boolean),
    ])
  ));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-4xl font-bold text-gray-800">Menuiserie</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal({ type: 'export' })}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
          >
            <Download className="h-5 w-5" /> Export
          </button>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" /> Nouveau bon
          </button>
        </div>
      </div>

      {/* Sous-sections */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {[...Object.entries(MENUISERIE_CATEGORIES), ['termines', 'Terminés']].map(([value, label]) => {
          const count = value === 'termines'
            ? orders.filter(isCompleted).length
            : orders.filter((o) => orderCategory(o) === value && !isCompleted(o)).length;
          const active = category === value;
          const activeStyle = value === 'termines'
            ? 'border-green-600 text-green-700 bg-green-50'
            : 'border-blue-600 text-blue-700 bg-blue-50';
          return (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap ${
                active ? activeStyle : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                active
                  ? (value === 'termines' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">Total</p><p className="text-2xl font-bold text-gray-800">{stats.total}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">À faire</p><p className="text-2xl font-bold text-gray-600">{stats.todo}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">En cours</p><p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">Terminés</p><p className="text-2xl font-bold text-green-600">{stats.completed}</p></div>
        <button
          onClick={() => setBillingFilter((f) => (f === 'pending' ? 'all' : 'pending'))}
          className={`bg-white p-4 rounded-lg shadow text-left hover:ring-2 hover:ring-amber-300 ${billingFilter === 'pending' ? 'ring-2 ring-amber-400' : ''}`}
        >
          <p className="text-sm text-gray-500">Devis / à facturer</p><p className="text-2xl font-bold text-amber-600">{stats.aTraiter}</p>
        </button>
        <button
          onClick={() => setBillingFilter((f) => (f === 'relances' ? 'all' : 'relances'))}
          className={`bg-white p-4 rounded-lg shadow text-left hover:ring-2 hover:ring-red-300 ${billingFilter === 'relances' ? 'ring-2 ring-red-400' : ''}`}
        >
          <p className="text-sm text-gray-500">Avec relances</p><p className="text-2xl font-bold text-red-600">{stats.relances}</p>
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Rechercher client, adresse, référence…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
          <option value="all">Tous les statuts</option>
          {Object.entries(MENUISERIE_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
          <option value="all">Tous les types</option>
          {typeFilterOptions.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
        <select value={billingFilter} onChange={(e) => setBillingFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
          <option value="all">Toute facturation</option>
          <option value="pending">À traiter (non facturé)</option>
          {Object.entries(BILLING_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          <option value="relances">Avec relances</option>
        </select>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-lg shadow divide-y">
        {sortedOrders.length === 0 && (
          <div className="p-8 text-center text-gray-500">Aucun bon ne correspond.</div>
        )}
        {sortedOrders.map((order) => {
          const ivs = orderInterventions(order);
          const aggregatedStatus = computeOrderStatus(ivs);
          const completedCount = ivs.filter((i) => i.status === 'completed').length;
          const relances = orderRelances(order);
          const totalHt = orderTotalHt(order);
          const billing = effectiveBillingStatus(order);
          const rowStyle = order.is_urgent
            ? 'border-l-4 border-red-600 bg-red-50'
            : relanceBorderStyle(relances.length);
          return (
          <div key={order.id} className={`p-4 flex items-center justify-between gap-4 ${rowStyle}`}>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {order.is_urgent && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                    <AlertTriangle className="h-3 w-3" /> URGENT
                  </span>
                )}
                <span className="font-semibold text-gray-800">{order.client_name || 'Client non renseigné'}</span>
                {order.bt_number && (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">BT {order.bt_number}</span>
                )}
                {category === 'termines' && (
                  <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                    {categoryLabel(orderCategory(order))}
                  </span>
                )}
                {order.reference && <span className="text-xs text-gray-400">({order.reference})</span>}
                <span className={`px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[aggregatedStatus] || ''}`}>
                  {statusLabel(aggregatedStatus)}
                </span>
                {billing && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${BILLING_STATUS_STYLES[billing]}`}>
                    {billingLabel(billing)}
                  </span>
                )}
                {relances.length > 0 && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${relanceBadgeStyle(relances.length)}`}>
                    <Bell className="h-3 w-3" />
                    {relances.length} relance{relances.length > 1 ? 's' : ''}
                  </span>
                )}
                {ivs.length > 1 && (
                  <span className="text-xs text-gray-500">
                    {completedCount}/{ivs.length} interventions
                  </span>
                )}
              </div>
              <div className="text-sm text-blue-600 space-y-0.5">
                {ivs.length === 0 ? (
                  <span className="text-gray-400 italic">Aucune intervention</span>
                ) : ivs.length === 1 ? (
                  <span>{typeLabel(ivs[0].type)}</span>
                ) : (
                  <ul className="list-disc list-inside">
                    {ivs.slice(0, 3).map((iv) => (
                      <li key={iv.id}>
                        {typeLabel(iv.type)}{' '}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${MENUISERIE_STATUS_STYLES[iv.status] || ''}`}>
                          {statusLabel(iv.status)}
                        </span>
                      </li>
                    ))}
                    {ivs.length > 3 && <li className="text-gray-400">+ {ivs.length - 3} autres…</li>}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                {orderReceivedDate(order) && (
                  <span className="flex items-center gap-1">
                    <Inbox className="h-3.5 w-3.5" />
                    Reçu le {new Date(orderReceivedDate(order)).toLocaleDateString('fr-FR')}
                  </span>
                )}
                {order.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{order.address}</span>}
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {order.assigned_profile?.Name || 'Non assigné'}
                </span>
                {order.charge_affaire && (
                  <span className="text-xs">CA : {order.charge_affaire}</span>
                )}
                {order.scheduled_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(order.scheduled_date).toLocaleDateString('fr-FR')}
                  </span>
                )}
                {totalHt > 0 && (
                  <span className="font-semibold text-gray-700">{fmtEuro(totalHt)} HT</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => toggleUrgent(order)}
                className={`p-2 rounded-lg ${order.is_urgent ? 'text-red-600 bg-red-100 hover:bg-red-200' : 'text-gray-400 hover:bg-gray-100 hover:text-red-600'}`}
                aria-label={order.is_urgent ? "Retirer l'urgence" : 'Marquer urgent'}
                title={order.is_urgent ? "Retirer l'urgence" : 'Marquer urgent'}
              >
                <AlertTriangle className="h-4 w-4" />
              </button>
              <button onClick={() => setModal({ type: 'billing', data: order })} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" aria-label="Facturation">
                <Euro className="h-4 w-4" />
              </button>
              <button onClick={() => setModal({ type: 'relances', data: order })} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg" aria-label="Relances">
                <Bell className="h-4 w-4" />
              </button>
              <button onClick={() => setModal({ type: 'detail', data: order })} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" aria-label="Voir">
                <Eye className="h-4 w-4" />
              </button>
              <button onClick={() => setModal({ type: 'edit', data: order })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" aria-label="Modifier">
                <Edit className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(order.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" aria-label="Supprimer">
                <Trash className="h-4 w-4" />
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {modal.type === 'create' && (
        <Modal title={`Nouveau bon — ${category === 'termines' ? 'Menuiserie' : categoryLabel(category)}`} onClose={() => setModal({ type: null })}>
          <OrderForm
            defaultCategory={category === 'termines' ? 'petites_interventions' : category}
            menuisiers={menuisiers}
            interventionOptions={interventionOptions}
            chargeAffaireOptions={chargeAffaireOptions}
            onSubmit={handleCreate}
            onCancel={() => setModal({ type: null })}
          />
        </Modal>
      )}
      {modal.type === 'edit' && (
        <Modal title="Modifier le bon" onClose={() => setModal({ type: null })}>
          <OrderForm
            order={modal.data}
            menuisiers={menuisiers}
            interventionOptions={interventionOptions}
            chargeAffaireOptions={chargeAffaireOptions}
            onSubmit={handleEdit}
            onCancel={() => setModal({ type: null })}
          />
        </Modal>
      )}
      {modal.type === 'billing' && (
        <Modal title={`Facturation — ${modal.data.client_name || 'bon'}`} onClose={() => setModal({ type: null })}>
          <BillingForm
            order={modal.data}
            onSaved={() => { setModal({ type: null }); loadData(); }}
            onCancel={() => setModal({ type: null })}
          />
        </Modal>
      )}
      {modal.type === 'relances' && (
        <Modal title={`Relances — ${modal.data.client_name || 'bon'}`} onClose={() => setModal({ type: null })}>
          <RelancesForm
            order={modal.data}
            onSaved={() => { setModal({ type: null }); loadData(); }}
            onCancel={() => setModal({ type: null })}
          />
        </Modal>
      )}
      {modal.type === 'detail' && (
        <Modal title={modal.data.client_name || 'Détail du bon'} onClose={() => setModal({ type: null })} wide>
          <OrderDetail order={modal.data} />
        </Modal>
      )}
      {modal.type === 'export' && (
        <Modal title={`Export mensuel — ${category === 'termines' ? 'Terminés' : categoryLabel(category)}`} onClose={() => setModal({ type: null })}>
          <ExportForm orders={categoryOrders} onClose={() => setModal({ type: null })} />
        </Modal>
      )}
    </div>
  );
}

// Formulaire d'export mensuel : choix du mois, filtre par statut,
// puis CSV (Excel) ou PDF. Une ligne par intervention, groupée par adresse.
const ExportForm = ({ orders, onClose }) => {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  // Statuts inclus dans l'export — tous cochés par défaut.
  const [statusChecked, setStatusChecked] = useState({
    todo: true,
    in_progress: true,
    completed: true,
  });

  const selectedStatuses = Object.entries(statusChecked)
    .filter(([, on]) => on)
    .map(([k]) => k);

  const toggleStatus = (key) =>
    setStatusChecked((s) => ({ ...s, [key]: !s[key] }));

  const nothingChecked = selectedStatuses.length === 0;

  const runCsv = () => {
    try {
      const n = exportMonthCsv(orders, month, selectedStatuses);
      setFeedback(n === 0
        ? `Aucune intervention sur ${monthLabel(month)} avec ces critères — fichier vide généré.`
        : `${n} intervention${n > 1 ? 's' : ''} exportée${n > 1 ? 's' : ''} (CSV téléchargé).`);
    } catch (e) {
      console.error('Erreur export CSV :', e);
      alert("Erreur lors de l'export CSV.");
    }
  };

  const runPdf = async () => {
    try {
      setBusy(true);
      const n = await exportMonthPdf(orders, month, selectedStatuses);
      setFeedback(n === 0
        ? `Aucune intervention sur ${monthLabel(month)} avec ces critères — PDF vide généré.`
        : `${n} intervention${n > 1 ? 's' : ''} exportée${n > 1 ? 's' : ''} (PDF ouvert).`);
    } catch (e) {
      console.error('Erreur export PDF :', e);
      alert("Erreur lors de l'export PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Mois à exporter</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
        <p className="text-xs text-gray-500 mt-1">
          Une ligne par intervention, groupée par adresse. La date de référence est
          la date de réalisation si l'intervention est terminée, sinon la date prévue du bon.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Statuts à inclure</label>
        <div className="flex flex-wrap gap-4">
          {[
            ['todo', 'À faire'],
            ['in_progress', 'En cours'],
            ['completed', 'Terminé'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={statusChecked[key]}
                onChange={() => toggleStatus(key)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className={`px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[key] || ''}`}>
                {label}
              </span>
            </label>
          ))}
        </div>
        {nothingChecked && (
          <p className="text-xs text-amber-600 mt-1">Coche au moins un statut.</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={runCsv}
          disabled={busy || !month || nothingChecked}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Excel / CSV
        </button>
        <button
          onClick={runPdf}
          disabled={busy || !month || nothingChecked}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" /> {busy ? 'Génération…' : 'PDF récapitulatif'}
        </button>
      </div>

      {feedback && <p className="text-sm text-blue-700">{feedback}</p>}

      <div className="flex justify-end pt-1">
        <button onClick={onClose} className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100">
          Fermer
        </button>
      </div>
    </div>
  );
};

export default MenuiserieManagement;
