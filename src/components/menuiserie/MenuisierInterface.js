import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  ArrowLeft, MapPin, Phone, User, Ruler, Camera, CheckCircle,
  Clock, Save, Trash2, ChevronRight, LogOut, FileText, X, Plus, Search,
  AlertTriangle, Calendar, Navigation, List, CalendarDays,
  Map as MapIcon, LocateFixed, MapPinOff, Loader2,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { describeDbError } from '../../services/dbErrors';
import { useAuth } from '../../contexts/AuthContext';
import {
  MENUISERIE_STATUS, MENUISERIE_STATUS_STYLES, MENUISERIE_PHOTO_CATEGORIES,
  typeLabel, statusLabel, computeOrderStatus, orderInterventions, newIntervention,
  findMenuiserieTrade, compareOrders, orderReceivedDate, sortInterventionOptions,
  MENUISERIE_TABS, orderMatchesTab, orderCategory, categoryLabel,
  telHref, smsHref, directionsUrls, isIOS,
} from '../../services/menuiserieService';
import { generateMenuiseriePdf, openOrDownloadPdf } from '../../services/menuiseriePdf';
import PhotoUploadButton from '../PhotoUploadButton';
import MeasurementsEditor from './MeasurementsEditor';
import AttachmentsEditor from './AttachmentsEditor';
import ScheduleModal from './ScheduleModal';
import { scheduledLabel, todayStr, timeToMinutes } from '../../services/planningService';
import useOrdersRealtime from '../../hooks/useOrdersRealtime';
import useGeolocation from '../../hooks/useGeolocation';
import useAutoGeocode from '../../hooks/useAutoGeocode';
import GeocodeProgress from './GeocodeProgress';
import NearbyOrders from './NearbyOrders';
import InstallAppHint from '../InstallAppHint';
import { isPlannable } from '../../services/planningService';
import { hasCoords, coordsOf, ordersWithin, RADIUS_OPTIONS, DEFAULT_RADIUS_KM } from '../../services/geoUtils';

// Planning (FullCalendar) et carte (Leaflet) chargés à la demande.
const PlanningPage = lazy(() => import('./PlanningPage'));
const OrdersMap = lazy(() => import('./OrdersMap'));
const LazySpinner = () => (
  <div className="flex items-center justify-center h-40">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
  </div>
);

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
  // Recherche + filtre statut (uniquement sur la liste des bons)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // Sous-section active, comme côté admin : petites interventions /
  // commande de portes / terminés (les bons terminés quittent leur sous-section)
  const [tab, setTab] = useState('petites_interventions');
  // Chip « Aujourd'hui » : n'affiche que les RDV du jour, toutes sous-sections
  // confondues, triés par heure.
  const [todayOnly, setTodayOnly] = useState(false);
  // Menuisiers (pour choisir/changer le menuisier dans le modal horaire)
  const [menuisiers, setMenuisiers] = useState([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // Vue de la liste : 'list' (bons), 'map' (carte / autour de moi) ou
  // 'planning' (calendrier partagé)
  const [view, setView] = useState('list');
  // Carte & proximité : rayon (km), centre choisi à la main, position GPS
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [mapCenter, setMapCenter] = useState(null);
  const geo = useGeolocation();

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;

  // Applique la recherche texte + le filtre statut sur la liste des bons.
  // La recherche matche client, adresse, référence, BT, chargé d'affaire, ET
  // sur le libellé de n'importe quelle intervention du bon.
  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      const ivs = orderInterventions(o);
      const aggStatus = computeOrderStatus(ivs);
      // Sous-section : même découpage que côté admin (terminés à part,
      // devis validés ou en attente). Le chip « Aujourd'hui » court-circuite
      // les onglets : tous les RDV du jour, sauf les bons annulés.
      if (todayOnly) {
        if (o.scheduled_date !== todayStr() || o.cancelled) return false;
      } else if (!orderMatchesTab(o, tab)) {
        return false;
      }
      if (statusFilter !== 'all' && aggStatus !== statusFilter) return false;
      if (!term) return true;
      const haystack = [
        o.client_name,
        o.client_phone,
        o.address,
        o.reference,
        o.bt_number,
        o.charge_affaire,
        ...ivs.map((iv) => iv.type),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    })
      // Même tri que la liste admin : urgents > relances > date de réception.
      // En mode « Aujourd'hui » : par heure de RDV (les « journée » en premier).
      .sort(todayOnly
        ? (a, b) => {
          const ta = a.scheduled_time ? timeToMinutes(a.scheduled_time) : -1;
          const tb = b.scheduled_time ? timeToMinutes(b.scheduled_time) : -1;
          return ta - tb || compareOrders(a, b);
        }
        : compareOrders);
  }, [orders, search, statusFilter, tab, todayOnly]);

  const todayCount = useMemo(
    () => orders.filter((o) => o.scheduled_date === todayStr() && !o.cancelled).length,
    [orders],
  );

  // Bons « ouverts » (ni terminés ni annulés) : la carte et la proximité
  // portent sur eux, toutes sous-sections confondues.
  const openOrders = useMemo(() => orders.filter((o) => isPlannable(o)), [orders]);
  // Centre de la carte : point choisi à la main, sinon position GPS.
  const mapCenterEffective = mapCenter || geo.position || null;

  // `silent` : rechargement en arrière-plan (Realtime), sans spinner — sinon
  // le menuisier serait éjecté de sa vue détail à chaque modification.
  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!user) return;
    try {
      if (!silent) setIsLoading(true);
      // On récupère TOUS les bons visibles à l'utilisateur : la sécurité
      // (menuisier ne voit que la menuiserie, admin voit tout, worker voit
      // tout via ses policies) est gérée côté RLS Supabase. Pas de filtre
      // client-side sur assigned_to, sinon le menuisier louperait les bons
      // que l'admin a créés sans lui assigner explicitement.
      const [ordersRes, tradesRes] = await Promise.all([
        supabase
          .from('menuiserie_orders')
          .select('*')
          .order('scheduled_date', { ascending: true, nullsFirst: false }),
        supabase.from('trades').select('*'),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (tradesRes.error) throw tradesRes.error;
      setOrders(ordersRes.data || []);
      // Liste des menuisiers pour le modal horaire. Tolérant : si la policy
      // `profiles` (migration 0015) n'est pas encore en place, on continue
      // sans (le choix du menuisier est simplement masqué).
      const { data: menuisiersData } = await supabase
        .from('profiles')
        .select('id, Name')
        .eq('role', 'menuisier');
      setMenuisiers(menuisiersData || []);
      const trade = findMenuiserieTrade(tradesRes.data || []);
      setInterventionOptions(sortInterventionOptions(trade?.tasks || []));
    } catch (error) {
      console.error('Erreur chargement bons menuiserie:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Les modifications des collègues / de l'admin arrivent toutes seules.
  useOrdersRealtime({ enabled: !!user, onChange: () => loadData({ silent: true }) });

  // Localisation automatique des adresses pas encore géocodées (la carte et
  // la proximité ne fonctionnent qu'avec des coordonnées).
  const geoProgress = useAutoGeocode(orders, { enabled: !!user && !isLoading, onDone: () => loadData({ silent: true }) });

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
    setScheduleOpen(false);
  };

  // Planification depuis le modal horaire : écriture partielle (le trigger
  // SQL trace qui a replanifié), puis mise à jour locale.
  const saveSchedule = async (patch) => {
    if (!selectedOrder) return;
    const { error } = await supabase
      .from('menuiserie_orders')
      .update(patch)
      .eq('id', selectedOrder.id);
    if (error) {
      console.error('Erreur planification :', error);
      alert(`Erreur lors de la planification — ${describeDbError(error)}`);
      return;
    }
    setOrders((prev) => prev.map((o) => (
      o.id === selectedOrder.id
        ? { ...o, ...patch, planning_updated_at: new Date().toISOString(), planning_updated_by: user?.id || null }
        : o
    )));
    setScheduleOpen(false);
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
              <h1 className="text-xl font-bold text-gray-800">Interventions menuiserie</h1>
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
              {showAllBons ? 'Tous les bons de menuiserie' : 'Interventions menuiserie'}
            </h2>
          </div>
        )}

        <main className={`${view === 'planning' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 py-6 space-y-3`}>
          {!embedded && <InstallAppHint />}
          {view !== 'map' && <GeocodeProgress progress={geoProgress} />}

          {/* Liste des bons / Carte / Planning partagé */}
          <div className="flex rounded-lg bg-gray-200 p-1 text-sm font-medium">
            {[
              ['list', 'Bons', List],
              ['map', 'Carte', MapIcon],
              ['planning', 'Planning', CalendarDays],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md ${view === key ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {view === 'planning' ? (
            <Suspense fallback={<LazySpinner />}>
              {/* L'ouvrier (embedded) consulte seulement ; le menuisier gère. */}
              <PlanningPage
                canEdit={!embedded}
                embedded
                onOpenOrder={(o) => setSelectedOrderId(o.id)}
                onEditIntervention={(o, iv) => { setSelectedOrderId(o.id); openIntervention(iv); }}
              />
            </Suspense>
          ) : view === 'map' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={geo.request}
                  disabled={geo.status === 'loading'}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {geo.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                  Autour de moi
                </button>
                <div className="flex items-center gap-1">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRadiusKm(r)}
                      className={`px-2.5 py-1.5 rounded-full text-xs font-medium border ${
                        radiusKm === r ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
                {mapCenter && (
                  <button onClick={() => setMapCenter(null)} className="text-xs text-gray-500 underline">
                    Oublier le point choisi
                  </button>
                )}
              </div>
              {geo.error && <p className="text-xs text-amber-700">{geo.error}</p>}
              <GeocodeProgress progress={geoProgress} />
              <p className="text-xs text-gray-500">
                {openOrders.filter(hasCoords).length} bon{openOrders.filter(hasCoords).length > 1 ? 's' : ''} localisé{openOrders.filter(hasCoords).length > 1 ? 's' : ''} sur {openOrders.length} en cours.
              </p>
              {!mapCenterEffective && (
                <p className="text-xs text-gray-500">
                  Touche « Autour de moi » (ou un point de la carte) pour voir les bons dans le rayon.
                  Rouge = urgent · orange = relancé · bleu = normal.
                </p>
              )}
              <Suspense fallback={<LazySpinner />}>
                <OrdersMap
                  orders={mapCenterEffective ? ordersWithin(openOrders, mapCenterEffective, 10000) : openOrders}
                  center={mapCenterEffective}
                  radiusKm={mapCenterEffective ? radiusKm : null}
                  userPosition={geo.position}
                  onSelect={(o) => setSelectedOrderId(o.id)}
                  onPickCenter={(ll) => setMapCenter(ll)}
                  fit={!mapCenterEffective}
                  className="h-[55vh]"
                />
              </Suspense>
              {mapCenterEffective && (
                <div className="bg-white rounded-lg shadow p-3">
                  <h3 className="font-semibold text-gray-800 mb-2 text-sm">Dans un rayon de {radiusKm} km</h3>
                  <NearbyOrders
                    origin={mapCenterEffective}
                    orders={openOrders}
                    radiusKm={radiusKm}
                    onRadiusChange={setRadiusKm}
                    onPick={(o) => setSelectedOrderId(o.id)}
                    emptyLabel="Aucun bon en cours dans ce rayon."
                  />
                </div>
              )}
              {openOrders.some((o) => o.address && !hasCoords(o)) && (
                <div className="text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><MapPinOff className="h-3.5 w-3.5" /> Non localisés (absents de la carte) :</span>{' '}
                  {openOrders.filter((o) => o.address && !hasCoords(o)).map((o) => (
                    <button key={o.id} onClick={() => setSelectedOrderId(o.id)} className="underline mr-2">
                      {o.client_name || 'Client'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <>
          {/* Sous-sections, comme côté admin */}
          <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
            {MENUISERIE_TABS.map(([value, label]) => {
              const count = orders.filter((o) => orderMatchesTab(o, value)).length;
              const active = tab === value;
              const activeStyle = value === 'termines'
                ? 'border-green-600 text-green-700 bg-green-50'
                : value === 'termines_factures'
                  ? 'border-emerald-700 text-emerald-800 bg-emerald-50'
                  : value === 'portes_validees'
                    ? 'border-teal-600 text-teal-700 bg-teal-50'
                    : 'border-blue-600 text-blue-700 bg-blue-50';
              const activeBadge = value === 'termines'
                ? 'bg-green-100 text-green-700'
                : value === 'termines_factures'
                  ? 'bg-emerald-100 text-emerald-800'
                  : value === 'portes_validees'
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-blue-100 text-blue-700';
              return (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap ${
                    active ? activeStyle : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    active ? activeBadge : 'bg-gray-100 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Barre de recherche + filtre statut */}
          {orders.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTodayOnly((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${
                  todayOnly
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                }`}
                title="Mes rendez-vous du jour, toutes sous-sections"
              >
                <Calendar className="h-4 w-4" />
                Aujourd'hui
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${todayOnly ? 'bg-white/20' : 'bg-indigo-100'}`}>
                  {todayCount}
                </span>
              </button>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Client, adresse, BT, type d'intervention…"
                  className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    aria-label="Effacer la recherche"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="all">Tous les statuts</option>
                {Object.entries(MENUISERIE_STATUS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          )}

          {/* Compteur si un filtre est actif */}
          {orders.length > 0 && (search || statusFilter !== 'all' || todayOnly) && (
            <p className="text-xs text-gray-500">
              {filteredOrders.length} bon{filteredOrders.length > 1 ? 's' : ''} sur {orders.length}
            </p>
          )}

          {orders.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Aucune intervention ne vous est assignée pour le moment.
            </div>
          )}

          {orders.length > 0 && filteredOrders.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 text-sm">
              {todayOnly
                ? "Aucun rendez-vous aujourd'hui."
                : search || statusFilter !== 'all'
                  ? 'Aucun bon ne correspond à ta recherche.'
                  : 'Aucun bon dans cette sous-section.'}
            </div>
          )}

          {filteredOrders.map((order) => {
            const ivs = orderInterventions(order);
            const aggStatus = computeOrderStatus(ivs);
            const done = ivs.filter((i) => i.status === 'completed').length;
            const tel = telHref(order.client_phone);
            const dirs = directionsUrls(order);
            return (
              <div
                key={order.id}
                className={`rounded-lg shadow hover:shadow-md transition-shadow ${
                  order.is_urgent ? 'bg-red-50 border-l-4 border-red-600' : 'bg-white'
                }`}
              >
              <button
                onClick={() => setSelectedOrderId(order.id)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {order.cancelled && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-600 text-white">
                        Annulé
                      </span>
                    )}
                    {!order.cancelled && order.is_urgent && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                        <AlertTriangle className="h-3 w-3" /> URGENT
                      </span>
                    )}
                    <span className="font-semibold text-gray-800">
                      {order.client_name || 'Client non renseigné'}
                    </span>
                    {order.bt_number && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">BT {order.bt_number}</span>
                    )}
                    {orderCategory(order) === 'commande_portes' && (
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">{categoryLabel('commande_portes')}</span>
                    )}
                    {orderCategory(order) === 'commande_portes' && order.devis_valide && (
                      <span className="flex items-center gap-1 text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-semibold">
                        <CheckCircle className="h-3 w-3" /> Devis validé
                      </span>
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
                  <p className="text-xs text-gray-400">
                    {orderReceivedDate(order) && (
                      <>Reçu le {new Date(orderReceivedDate(order)).toLocaleDateString('fr-FR')}</>
                    )}
                    {orderReceivedDate(order) && order.scheduled_date && ' · '}
                    {order.scheduled_date && (
                      <span className="font-medium text-indigo-700">RDV {scheduledLabel(order)}</span>
                    )}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              </button>
              {(tel || dirs) && (
                <div className="flex gap-2 px-4 pb-3 -mt-1">
                  {tel && (
                    <a href={tel} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
                      <Phone className="h-4 w-4" /> Appeler
                    </a>
                  )}
                  {dirs && (
                    <a href={dirs.google} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                      <Navigation className="h-4 w-4" /> Itinéraire
                    </a>
                  )}
                </div>
              )}
              </div>
            );
          })}
          </>
          )}
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
                multiple
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

          {/* Date d'intervention */}
          <section className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" /> Date d'intervention
            </h2>
            <input
              type="date"
              value={draftIv.intervention_date || ''}
              onChange={(e) => setDraftIv((d) => ({ ...d, intervention_date: e.target.value || null }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Date à laquelle l'intervention a été (ou sera) réalisée — reprise dans le rapport PDF.
            </p>
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
        {selectedOrder.cancelled && (
          <div className="px-4 py-3 bg-gray-600 text-white rounded-lg text-sm space-y-1">
            <p className="font-bold">
              BON ANNULÉ{selectedOrder.cancelled_date ? ` le ${new Date(selectedOrder.cancelled_date).toLocaleDateString('fr-FR')}` : ''}
            </p>
            {selectedOrder.cancelled_reason && (
              <p className="text-gray-100 whitespace-pre-wrap">{selectedOrder.cancelled_reason}</p>
            )}
          </div>
        )}
        {!selectedOrder.cancelled && selectedOrder.is_urgent && (
          <p className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg text-sm font-bold">
            <AlertTriangle className="h-5 w-5" /> CHANTIER URGENT
          </p>
        )}
        {/* Rendez-vous : le menuisier peut (re)planifier lui-même */}
        {!selectedOrder.cancelled && (
          <section className="bg-white rounded-lg shadow p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-5 w-5 text-indigo-600 flex-shrink-0" />
              {selectedOrder.scheduled_date ? (
                <span className="font-semibold text-gray-800">{scheduledLabel(selectedOrder)}</span>
              ) : (
                <span className="text-gray-500 italic">Pas encore planifié</span>
              )}
            </div>
            <button
              onClick={() => setScheduleOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              <Clock className="h-4 w-4" />
              {selectedOrder.scheduled_date ? "Modifier l'horaire" : 'Planifier'}
            </button>
          </section>
        )}
        {scheduleOpen && (
          <ScheduleModal
            order={selectedOrder}
            orders={orders}
            menuisiers={menuisiers}
            onSave={saveSchedule}
            onClose={() => setScheduleOpen(false)}
          />
        )}

        {/* Bons à proximité : enchaîner les interventions proches */}
        {!selectedOrder.cancelled && (
          <section className="bg-white rounded-lg shadow p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-gray-400" /> Bons à proximité
            </h2>
            {hasCoords(selectedOrder) ? (
              <>
                <Suspense fallback={<LazySpinner />}>
                  <OrdersMap
                    orders={[selectedOrder, ...ordersWithin(openOrders.filter((o) => o.id !== selectedOrder.id), coordsOf(selectedOrder), radiusKm)]}
                    center={coordsOf(selectedOrder)}
                    radiusKm={radiusKm}
                    selectedId={selectedOrder.id}
                    onSelect={(o) => { if (o.id !== selectedOrder.id) setSelectedOrderId(o.id); }}
                    className="h-56"
                  />
                </Suspense>
                <NearbyOrders
                  origin={coordsOf(selectedOrder)}
                  orders={openOrders.filter((o) => o.id !== selectedOrder.id)}
                  radiusKm={radiusKm}
                  onRadiusChange={setRadiusKm}
                  onPick={(o) => setSelectedOrderId(o.id)}
                  emptyLabel="Aucun autre bon en cours dans ce rayon."
                />
              </>
            ) : (
              <p className="text-sm text-gray-500 italic flex items-center gap-1.5">
                <MapPinOff className="h-4 w-4" /> Adresse non localisée — proximité indisponible (l'admin peut préciser l'adresse).
              </p>
            )}
          </section>
        )}

        {/* Infos client (lecture seule) */}
        <section className="bg-white rounded-lg shadow p-5 space-y-2">
          <h2 className="font-semibold text-gray-800 mb-2">Détails</h2>
          {selectedOrder.client_name && (
            <p className="text-sm flex items-center gap-2 text-gray-700">
              <User className="h-4 w-4 text-gray-400" /> {selectedOrder.client_name}
            </p>
          )}
          {selectedOrder.client_phone && (
            <div className="text-sm flex items-center gap-2 text-gray-700 flex-wrap">
              <Phone className="h-4 w-4 text-gray-400" /> {selectedOrder.client_phone}
              {telHref(selectedOrder.client_phone) && (
                <>
                  <a href={telHref(selectedOrder.client_phone)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">
                    <Phone className="h-3.5 w-3.5" /> Appeler
                  </a>
                  <a href={smsHref(selectedOrder.client_phone)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200">
                    SMS
                  </a>
                </>
              )}
            </div>
          )}
          {selectedOrder.address && (
            <div className="text-sm flex items-center gap-2 text-gray-700 flex-wrap">
              <MapPin className="h-4 w-4 text-gray-400" /> {selectedOrder.address}
              {directionsUrls(selectedOrder) && (
                <>
                  <a href={directionsUrls(selectedOrder).google} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">
                    <Navigation className="h-3.5 w-3.5" /> Itinéraire
                  </a>
                  {isIOS() && (
                    <a href={directionsUrls(selectedOrder).apple} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200">
                      Plans
                    </a>
                  )}
                </>
              )}
            </div>
          )}
          {(selectedOrder.charge_affaire || selectedOrder.bt_number || orderReceivedDate(selectedOrder)) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 pt-2 border-t mt-2">
              {selectedOrder.charge_affaire && (
                <span><span className="text-gray-500">CA :</span> {selectedOrder.charge_affaire}</span>
              )}
              {selectedOrder.bt_number && (
                <span><span className="text-gray-500">N° de BT :</span> {selectedOrder.bt_number}</span>
              )}
              {orderReceivedDate(selectedOrder) && (
                <span><span className="text-gray-500">Reçu le :</span> {new Date(orderReceivedDate(selectedOrder)).toLocaleDateString('fr-FR')}</span>
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
