import React from 'react';
import { AlertTriangle, Bell, MapPin, ChevronRight } from 'lucide-react';
import { RADIUS_OPTIONS, ordersWithin, distanceLabel } from '../../services/geoUtils';
import { orderCategory, categoryLabel, typeLabel, orderInterventions } from '../../services/menuiserieService';
import { scheduledLabel } from '../../services/planningService';

// Liste « à proximité » partagée admin / menuisier : bons localisés dans le
// rayon autour de `origin`, du plus proche au plus loin.
//
// Props :
//   origin        { lat, lng }
//   orders        candidats (déjà filtrés métier : ouverts, hors bon courant…)
//   radiusKm / onRadiusChange
//   onPick(order)          tap sur la ligne
//   renderAction(order)    bouton supplémentaire par ligne (ex. « Planifier »)
//   emptyLabel
export default function NearbyOrders({
  origin,
  orders,
  radiusKm,
  onRadiusChange,
  onPick,
  renderAction,
  emptyLabel = 'Aucun bon dans ce rayon.',
  maxItems = 30,
}) {
  const nearby = ordersWithin(orders, origin, radiusKm).slice(0, maxItems);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Rayon :</span>
        {RADIUS_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => onRadiusChange?.(r)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              radiusKm === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {r} km
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">{nearby.length} bon{nearby.length > 1 ? 's' : ''}</span>
      </div>

      {nearby.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
          {nearby.map((o) => {
            const ivs = orderInterventions(o);
            const relances = Array.isArray(o.relances) ? o.relances.length : 0;
            return (
              <li key={o.id} className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => onPick?.(o)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5 flex-wrap text-sm">
                    <span className="font-semibold text-blue-700 whitespace-nowrap">{distanceLabel(o.distanceKm)}</span>
                    <span className="font-medium text-gray-800 truncate">{o.client_name || 'Client'}</span>
                    {o.is_urgent && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                    {relances > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 rounded-full bg-orange-100 text-orange-800">
                        <Bell className="h-3 w-3" /> {relances}
                      </span>
                    )}
                    {orderCategory(o) === 'commande_portes' && (
                      <span className="text-[10px] px-1.5 rounded-full bg-indigo-100 text-indigo-800">{categoryLabel('commande_portes')}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 flex-shrink-0" /> {o.address}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {ivs[0] ? typeLabel(ivs[0].type) : ''}{ivs.length > 1 ? ` +${ivs.length - 1}` : ''}
                    {o.scheduled_date ? ` · RDV ${scheduledLabel(o, { withDuration: false })}` : ' · pas de RDV'}
                  </div>
                </button>
                {renderAction ? renderAction(o) : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
