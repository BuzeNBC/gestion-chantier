import React, { useState } from 'react';
import { FileText, Ban, AlertTriangle, Phone, Navigation } from 'lucide-react';
import {
  MENUISERIE_STATUS_STYLES, MENUISERIE_PHOTO_CATEGORIES, typeLabel, statusLabel,
  computeOrderStatus, orderInterventions, BILLING_STATUS_STYLES, billingLabel,
  effectiveBillingStatus, orderCategory, orderReceivedDate, relanceBadgeStyle,
  orderRelances, orderTotalHt, fmtEuro, telHref, directionsUrls,
} from '../../services/menuiserieService';
import { scheduledLabel } from '../../services/planningService';
import { generateMenuiseriePdf, openOrDownloadPdf } from '../../services/menuiseriePdf';
import MeasurementsEditor from './MeasurementsEditor';
import AttachmentsEditor from './AttachmentsEditor';

// Détail complet d'un bon (lecture seule) côté admin : infos, facturation,
// relances, pièces jointes, interventions (cotes, photos, notes) + rapport PDF.
// Utilisé dans la liste admin et depuis le planning.
const OrderDetail = ({ order, hideBilling = false }) => {
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
    {order.cancelled && (
      <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm space-y-1">
        <p className="flex items-center gap-2 font-semibold text-gray-700">
          <Ban className="h-4 w-4" />
          Bon annulé{order.cancelled_date ? ` le ${new Date(order.cancelled_date).toLocaleDateString('fr-FR')}` : ''}
        </p>
        {order.cancelled_reason && (
          <p className="text-gray-600 whitespace-pre-wrap">{order.cancelled_reason}</p>
        )}
      </div>
    )}
    {!order.cancelled && order.is_urgent && (
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
      {order.client_phone && (
        <div className="flex items-center gap-2 flex-wrap">
          <span><span className="text-gray-500">Tél :</span> {order.client_phone}</span>
          {telHref(order.client_phone) && (
            <a href={telHref(order.client_phone)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 hover:bg-green-200">
              <Phone className="h-3 w-3" /> Appeler
            </a>
          )}
        </div>
      )}
      {order.address && (
        <div className="col-span-2 flex items-center gap-2 flex-wrap">
          <span><span className="text-gray-500">Adresse :</span> {order.address}</span>
          {directionsUrls(order) && (
            <a href={directionsUrls(order).google} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 hover:bg-blue-200">
              <Navigation className="h-3 w-3" /> Itinéraire
            </a>
          )}
        </div>
      )}
      {order.charge_affaire && (
        <div><span className="text-gray-500">Chargé d'affaire :</span> {order.charge_affaire}</div>
      )}
      {order.bt_number && (
        <div><span className="text-gray-500">N° de BT :</span> {order.bt_number}</div>
      )}
      {order.scheduled_date && (
        <div><span className="text-gray-500">Prévu :</span> {scheduledLabel(order)}</div>
      )}
      {orderReceivedDate(order) && (
        <div><span className="text-gray-500">Reçu le :</span> {new Date(orderReceivedDate(order)).toLocaleDateString('fr-FR')}</div>
      )}
      {orderCategory(order) === 'commande_portes' && (
        <div>
          <span className="text-gray-500">Devis :</span>{' '}
          {order.devis_valide ? (
            <span className="px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-800 font-semibold">
              Validé{order.devis_valide_date ? ` le ${new Date(order.devis_valide_date).toLocaleDateString('fr-FR')}` : ''}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">En attente de validation</span>
          )}
        </div>
      )}
      {!hideBilling && (
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
      )}
      {!hideBilling && orderTotalHt(order) > 0 && (
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
              {!hideBilling && Number.isFinite(Number(iv.price_ht)) && iv.price_ht !== null && iv.price_ht !== '' && (
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

export default OrderDetail;
