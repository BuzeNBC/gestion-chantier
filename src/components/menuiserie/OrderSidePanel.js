import React from 'react';
import { X } from 'lucide-react';
import OrderDetail from './OrderDetail';
import { MENUISERIE_STATUS_STYLES, statusLabel, computeOrderStatus, orderInterventions } from '../../services/menuiserieService';

// Volet latéral (grand écran) : le bon complet affiché À CÔTÉ du planning ou
// de la carte, au lieu d'une petite fenêtre à faire défiler.
//   actions      boutons en tête (Modifier l'horaire, Ouvrir la fiche…)
//   hideBilling  masque facturation et prix (interface menuisier)
//   heightClass  hauteur max (par défaut : calée sur la fenêtre)
export default function OrderSidePanel({
  order,
  onClose,
  hideBilling = false,
  actions = null,
  heightClass = 'max-h-[calc(100vh-7rem)] sticky top-4',
  className = '',
}) {
  const status = computeOrderStatus(orderInterventions(order));
  return (
    <aside className={`w-full lg:w-[26rem] xl:w-[30rem] flex-shrink-0 bg-white rounded-lg shadow border border-gray-200 flex flex-col ${heightClass} ${className}`}>
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-200">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{order.client_name || 'Bon'}</h3>
          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[status] || ''}`}>
            {statusLabel(status)}
          </span>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="p-1 text-gray-400 hover:text-gray-700 rounded">
          <X className="h-5 w-5" />
        </button>
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50">{actions}</div>
      )}
      <div className="overflow-y-auto px-4 py-3 text-sm">
        <OrderDetail order={order} hideBilling={hideBilling} />
      </div>
    </aside>
  );
}
