import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, Users, Clock, Edit } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { describeDbError } from '../../services/dbErrors';
import { useAuth } from '../../contexts/AuthContext';
import {
  colorForMenuisier, orderToEvent, findConflicts, conflictsFor, isPlannable, hhmm, durationLabel,
  DEFAULT_DURATION,
} from '../../services/planningService';
import useOrdersRealtime from '../../hooks/useOrdersRealtime';
import PlanningCalendar from './PlanningCalendar';
import UnscheduledPanel from './UnscheduledPanel';
import ScheduleModal from './ScheduleModal';
import Modal from './MenuiserieModal';
import OrderDetail from './OrderDetail';
import OrderSidePanel from './OrderSidePanel';

// Page « Planning » partagée : calendrier commun à tous les menuisiers,
// géré par l'admin ET les menuisiers. Charge ses propres données, s'abonne
// au Realtime, écrit des patches partiels (scheduled_date / scheduled_time /
// duration_minutes / assigned_to).
//
// Props :
//   canEdit      drag & drop + modal d'édition (false = consultation)
//   embedded     rendu dans l'interface menuisier (pas de titre de page)
//   showDetail   l'admin peut ouvrir le détail complet d'un bon (OrderDetail)
const FILTER_KEY = 'planning.filter';
const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
};

//   onOpenOrder(order)  ouvre la fiche du bon dans l'interface hôte (menuisier) ;
//                       sinon, avec showDetail, le détail s'ouvre dans un modal (admin)
//   onEditIntervention(order, iv)  ouvre directement l'écran de saisie d'une
//                       intervention (photos, cotes, remarques, statut)
export default function PlanningPage({ canEdit = false, embedded = false, showDetail = false, onOpenOrder, onEditIntervention }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const calendarRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [menuisiers, setMenuisiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(() => {
    try { return localStorage.getItem(FILTER_KEY) || 'all'; } catch { return 'all'; }
  });
  const [showDone, setShowDone] = useState(false);
  const [schedule, setSchedule] = useState(null);   // { order, defaults }
  const [detailOrder, setDetailOrder] = useState(null);
  // Grand écran : bon sélectionné, affiché dans le volet latéral
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, filter); } catch { /* stockage indisponible */ }
  }, [filter]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [ordersRes, menuisiersRes] = await Promise.all([
        supabase.from('menuiserie_orders').select('*'),
        supabase.from('profiles').select('id, Name').eq('role', 'menuisier'),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      setOrders(ordersRes.data || []);
      // Tolérant : sans la policy profiles (migration 0015), liste vide.
      setMenuisiers(menuisiersRes.data || []);
    } catch (e) {
      console.error('Erreur chargement planning :', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useOrdersRealtime({ onChange: () => loadData({ silent: true }) });

  const menuisiersById = useMemo(
    () => Object.fromEntries(menuisiers.map((m) => [m.id, m])),
    [menuisiers],
  );
  const sortedMenuisiers = useMemo(
    () => [...menuisiers].sort((a, b) => (a.Name || '').localeCompare(b.Name || '', 'fr')),
    [menuisiers],
  );
  const colorOf = useCallback((id) => colorForMenuisier(id, menuisiers), [menuisiers]);

  const matchesFilter = useCallback((o) => {
    if (filter === 'all') return true;
    if (filter === 'unassigned') return !o.assigned_to;
    return o.assigned_to === filter;
  }, [filter]);

  const scheduled = useMemo(
    () => orders.filter((o) => o.scheduled_date && !o.cancelled && (showDone || isPlannable(o))),
    [orders, showDone],
  );
  const conflicts = useMemo(() => findConflicts(scheduled.filter(isPlannable)), [scheduled]);
  const events = useMemo(
    () => scheduled.filter(matchesFilter).map((o) => orderToEvent(o, {
      colorOf, conflicts, done: !isPlannable(o), selected: o.id === selectedId,
    })),
    [scheduled, matchesFilter, colorOf, conflicts, selectedId],
  );
  const selectedOrder = useMemo(
    () => (selectedId ? orders.find((o) => o.id === selectedId) || null : null),
    [orders, selectedId],
  );
  const unscheduled = useMemo(
    () => orders.filter((o) => !o.scheduled_date && isPlannable(o) && matchesFilter(o)),
    [orders, matchesFilter],
  );

  const showToast = (msg, kind = 'warn') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 5000);
  };

  // Écriture partielle + mise à jour locale optimiste ; `revert` (FullCalendar)
  // remet l'événement à sa place si la base refuse.
  const applyPatch = async (order, patch, revert) => {
    const previous = orders;
    const updated = { ...order, ...patch };
    setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    const { error } = await supabase.from('menuiserie_orders').update(patch).eq('id', order.id);
    if (error) {
      console.error('Erreur planning :', error);
      setOrders(previous);
      revert?.();
      showToast(`Impossible d'enregistrer — ${describeDbError(error)}`, 'error');
      return false;
    }
    const c = conflictsFor(updated, orders.filter((o) => o.id !== order.id));
    if (c.length > 0) {
      showToast(`Attention : chevauche ${c.map((x) => `${x.client_name || 'Client'} (${hhmm(x.scheduled_time)})`).join(', ')}.`);
    }
    return true;
  };

  // Sur la page admin, pas de confirmation « RDV d'un collègue ».
  const isAdminLike = !embedded;

  const onEventChange = async (order, patch, revert) => {
    if (!canEdit) { revert?.(); return; }
    // Garde-fou doigt : déplacer le RDV d'un AUTRE menuisier demande confirmation.
    if (order.assigned_to && user?.id && order.assigned_to !== user.id && !isAdminLike) {
      const who = menuisiersById[order.assigned_to]?.Name || 'un collègue';
      if (!window.confirm(`Ce rendez-vous est à ${who}. Le déplacer quand même ?`)) { revert?.(); return; }
    }
    await applyPatch(order, patch, revert);
  };

  const onExternalDrop = async (orderId, patch) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !canEdit) return;
    await applyPatch(order, patch);
  };

  const onDateClick = (info) => {
    // Clic sur un créneau vide : rien par défaut (évite les créations
    // accidentelles au doigt). Sur PC, pourrait ouvrir « À planifier ».
    void info;
  };

  const openSchedule = (order, defaults = {}) => setSchedule({ order, defaults });

  const onScheduleSave = async (patch) => {
    const ok = await applyPatch(schedule.order, patch);
    if (ok) setSchedule(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const chip = (value, label, color) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border whitespace-nowrap ${
        filter === value ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {color && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );

  return (
    <div className={`space-y-4 ${embedded ? '' : ''}`}>
      {!embedded && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl lg:text-4xl font-bold text-gray-800">Planning menuiserie</h1>
          <p className="text-sm text-gray-500 hidden md:block">
            Glisse les rendez-vous pour les déplacer, étire-les pour changer la durée, clique pour modifier.
          </p>
        </div>
      )}

      {/* Filtres par menuisier + options */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
        {chip('all', 'Tous')}
        {sortedMenuisiers.map((m) => chip(m.id, m.Name || m.id, colorOf(m.id)))}
        {chip('unassigned', 'Non assignés', colorOf(null))}
        <label className="ml-auto flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Terminés
        </label>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
          toast.kind === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-orange-50 text-orange-800 border border-orange-200'
        }`}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {toast.msg}
        </div>
      )}

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 bg-white rounded-lg shadow p-2 sm:p-3">
          <PlanningCalendar
            calendarRef={calendarRef}
            events={events}
            canEdit={canEdit}
            isMobile={isMobile}
            menuisiersById={menuisiersById}
            onEventClick={(order) => {
              // Grand écran : le bon complet s'affiche à côté du calendrier.
              if (!isMobile) { setSelectedId(order.id); return; }
              if (canEdit) openSchedule(order);
              else if (onOpenOrder) onOpenOrder(order);
              else if (showDetail) setDetailOrder(order);
            }}
            onEventChange={onEventChange}
            onExternalDrop={onExternalDrop}
            onDateClick={onDateClick}
          />
        </div>
        {!isMobile && selectedOrder ? (
          <OrderSidePanel
            order={selectedOrder}
            hideBilling={embedded}
            onClose={() => setSelectedId(null)}
            onEditIntervention={onEditIntervention ? (iv) => onEditIntervention(selectedOrder, iv) : undefined}
            actions={(
              <>
                {onOpenOrder && (
                  <button
                    onClick={() => onOpenOrder(selectedOrder)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
                    title="Photos, cotes, remarques, statut, rapport"
                  >
                    <Edit className="h-3.5 w-3.5" /> Remplir le bon
                  </button>
                )}
                {canEdit && !selectedOrder.cancelled && (
                  <button
                    onClick={() => openSchedule(selectedOrder)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                  >
                    <Clock className="h-3.5 w-3.5" /> {selectedOrder.scheduled_date ? "Modifier l'horaire" : 'Planifier'}
                  </button>
                )}
              </>
            )}
          />
        ) : canEdit && (
          <UnscheduledPanel
            orders={unscheduled}
            isMobile={isMobile}
            canEdit={canEdit}
            onPick={(order) => {
              const api = calendarRef.current?.getApi?.();
              const viewDate = api ? api.getDate() : new Date();
              const d = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(viewDate.getDate()).padStart(2, '0')}`;
              openSchedule(order, { date: d, time: '09:00', duration: order.duration_minutes || DEFAULT_DURATION });
            }}
          />
        )}
      </div>

      {/* Légende */}
      <p className="text-xs text-gray-500">
        Bordure rouge = urgent · pointillés orange = chevauchement avec un autre RDV du même menuisier ·
        durée par défaut {durationLabel(DEFAULT_DURATION)}.
      </p>

      {schedule && (
        <ScheduleModal
          order={schedule.order}
          orders={orders}
          menuisiers={menuisiers}
          defaults={schedule.defaults}
          onSave={onScheduleSave}
          onClose={() => setSchedule(null)}
          onOpenOrder={onOpenOrder
            ? () => { const o = schedule.order; setSchedule(null); onOpenOrder(o); }
            : showDetail
              ? () => { setDetailOrder(schedule.order); setSchedule(null); }
              : undefined}
        />
      )}
      {detailOrder && (
        <Modal title={detailOrder.client_name || 'Détail du bon'} onClose={() => setDetailOrder(null)} wide>
          <OrderDetail order={detailOrder} />
        </Modal>
      )}
    </div>
  );
}
