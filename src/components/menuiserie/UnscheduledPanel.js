import React, { useEffect, useRef, useState } from 'react';
import { Draggable } from '@fullcalendar/interaction';
import { AlertTriangle, Bell, CalendarPlus, GripVertical, Search, X } from 'lucide-react';
import { compareOrders, orderRelances, orderCategory, categoryLabel, typeLabel, orderInterventions } from '../../services/menuiserieService';
import { DEFAULT_DURATION, pad2 } from '../../services/planningService';

// Bons ouverts sans date de rendez-vous.
//   - PC : colonne latérale, chaque bon se glisse sur le calendrier
//     (Draggable FullCalendar, détruit au démontage — StrictMode-safe).
//   - Mobile : bouton flottant « À planifier (N) » -> feuille en bas de
//     l'écran -> tap sur un bon -> `onPick(order)` (le parent ouvre le modal).
const durationStr = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

const OrderItem = ({ order, onPick, draggable }) => {
  const ivs = orderInterventions(order);
  const relances = orderRelances(order).length;
  return (
    <div
      className={`fc-draggable-item flex items-start gap-2 p-2.5 rounded-lg border bg-white text-sm ${
        order.is_urgent ? 'border-red-300' : 'border-gray-200'
      } ${draggable ? 'cursor-grab active:cursor-grabbing hover:shadow' : ''}`}
      data-order-id={order.id}
      data-title={order.client_name || 'Client'}
      data-duration={durationStr(Number(order.duration_minutes) || DEFAULT_DURATION)}
    >
      {draggable && <GripVertical className="h-4 w-4 text-gray-300 mt-0.5 flex-shrink-0" />}
      <button onClick={() => onPick?.(order)} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {order.is_urgent && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
          <span className="font-medium text-gray-800 truncate">{order.client_name || 'Client'}</span>
          {relances > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 rounded-full bg-orange-100 text-orange-800">
              <Bell className="h-3 w-3" /> {relances}
            </span>
          )}
          {orderCategory(order) === 'commande_portes' && (
            <span className="text-[10px] px-1.5 rounded-full bg-indigo-100 text-indigo-800">{categoryLabel('commande_portes')}</span>
          )}
        </div>
        {ivs[0] && <div className="text-xs text-blue-700 truncate">{typeLabel(ivs[0].type)}{ivs.length > 1 ? ` +${ivs.length - 1}` : ''}</div>}
        {order.address && <div className="text-xs text-gray-500 truncate">{order.address}</div>}
      </button>
    </div>
  );
};

export default function UnscheduledPanel({ orders, onPick, isMobile = false, canEdit = true }) {
  const containerRef = useRef(null);
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const term = search.trim().toLowerCase();
  const list = [...orders]
    .filter((o) => !term || [o.client_name, o.address, o.bt_number].filter(Boolean).join(' ').toLowerCase().includes(term))
    .sort(compareOrders);

  // Drag externe (PC uniquement)
  useEffect(() => {
    if (isMobile || !canEdit || !containerRef.current) return undefined;
    const draggable = new Draggable(containerRef.current, {
      itemSelector: '.fc-draggable-item',
      eventData: (el) => ({
        id: el.dataset.orderId,
        title: el.dataset.title,
        duration: el.dataset.duration,
        create: true,
      }),
    });
    return () => draggable.destroy();
  }, [isMobile, canEdit]);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-5 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 text-white shadow-lg font-medium"
        >
          <CalendarPlus className="h-5 w-5" /> À planifier ({orders.length})
        </button>
        {sheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setSheetOpen(false)}>
            <div className="w-full max-h-[75vh] bg-gray-50 rounded-t-2xl p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">À planifier ({list.length})</h3>
                <button onClick={() => setSheetOpen(false)} className="p-1 text-gray-500" aria-label="Fermer"><X className="h-5 w-5" /></button>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client, adresse, BT…" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
              </div>
              <div className="space-y-2">
                {list.length === 0 && <p className="text-sm text-gray-500 italic">Rien à planifier.</p>}
                {list.map((o) => (
                  <OrderItem key={o.id} order={o} onPick={(order) => { setSheetOpen(false); onPick?.(order); }} draggable={false} />
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <aside className="w-72 flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3 self-start">
      <div>
        <h3 className="font-semibold text-gray-800">À planifier <span className="text-gray-500 font-normal">({list.length})</span></h3>
        <p className="text-xs text-gray-500">Glisse un bon sur le calendrier, ou clique pour choisir la date.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client, adresse, BT…" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
      </div>
      <div ref={containerRef} className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
        {list.length === 0 && <p className="text-sm text-gray-500 italic">Rien à planifier.</p>}
        {list.map((o) => <OrderItem key={o.id} order={o} onPick={onPick} draggable={canEdit} />)}
      </div>
    </aside>
  );
}
