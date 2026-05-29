import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  Plus, Edit, Trash, X, Search, Eye, MapPin, User, Calendar,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { DBService, STORES, generateUUID } from '../../services/dbService';
import {
  MENUISERIE_TYPES, MENUISERIE_STATUS, MENUISERIE_STATUS_STYLES,
  MENUISERIE_PHOTO_CATEGORIES, typeLabel, statusLabel,
} from '../../services/menuiserieService';
import MeasurementsEditor from './MeasurementsEditor';

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
  type: 'reparation_vr',
  client_name: '',
  client_phone: '',
  address: '',
  description: '',
  assigned_to: '',
  scheduled_date: '',
  reference: '',
};

const OrderForm = ({ order, menuisiers, onSubmit, onCancel }) => {
  const [form, setForm] = useState(order ? {
    type: order.type || 'reparation_vr',
    client_name: order.client_name || '',
    client_phone: order.client_phone || '',
    address: order.address || '',
    description: order.description || '',
    assigned_to: order.assigned_to || '',
    scheduled_date: order.scheduled_date || '',
    reference: order.reference || '',
  } : emptyForm);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const submit = () => {
    if (!form.client_name.trim()) {
      alert('Le nom du client est obligatoire.');
      return;
    }
    onSubmit({ ...form, assigned_to: form.assigned_to || null });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Type d'intervention</label>
        <select
          value={form.type}
          onChange={(e) => set('type', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          {Object.entries(MENUISERIE_TYPES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

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

const OrderDetail = ({ order }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div><span className="text-gray-500">Type :</span> {typeLabel(order.type)}</div>
      <div>
        <span className="text-gray-500">Statut :</span>{' '}
        <span className={`px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[order.status] || ''}`}>
          {statusLabel(order.status)}
        </span>
      </div>
      {order.client_phone && <div><span className="text-gray-500">Tél :</span> {order.client_phone}</div>}
      {order.address && <div className="col-span-2"><span className="text-gray-500">Adresse :</span> {order.address}</div>}
      {order.scheduled_date && (
        <div><span className="text-gray-500">Prévu :</span> {new Date(order.scheduled_date).toLocaleDateString('fr-FR')}</div>
      )}
      {order.completed_date && (
        <div><span className="text-gray-500">Réalisé :</span> {new Date(order.completed_date).toLocaleDateString('fr-FR')}</div>
      )}
    </div>

    {order.description && (
      <div>
        <h3 className="font-medium text-gray-700 mb-1">Description</h3>
        <p className="text-sm text-gray-600">{order.description}</p>
      </div>
    )}

    <div>
      <h3 className="font-medium text-gray-700 mb-2">Cotes relevées</h3>
      <MeasurementsEditor measurements={order.measurements || []} onChange={() => {}} readOnly />
    </div>

    <div>
      <h3 className="font-medium text-gray-700 mb-2">Photos</h3>
      {(order.photos || []).length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucune photo.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {order.photos.map((p) => (
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

    {order.notes && (
      <div>
        <h3 className="font-medium text-gray-700 mb-1">Notes du menuisier</h3>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
      </div>
    )}
  </div>
);

function MenuiserieManagement() {
  const [orders, setOrders] = useState([]);
  const [menuisiers, setMenuisiers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState({ type: null, data: null });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [ordersRes, menuisiersRes] = await Promise.all([
        supabase
          .from('menuiserie_orders')
          .select('*, assigned_profile:assigned_to(id, Name)')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, Name, role').eq('role', 'menuisier'),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (menuisiersRes.error) throw menuisiersRes.error;

      setOrders(ordersRes.data || []);
      setMenuisiers(menuisiersRes.data || []);
    } catch (error) {
      console.error('Erreur chargement menuiserie:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (formData) => {
    try {
      const newOrder = {
        ...formData,
        id: generateUUID(),
        status: 'todo',
        measurements: [],
        photos: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await DBService.store(STORES.MENUISERIE, newOrder);
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
      const updated = {
        ...rest,
        ...formData,
        updated_at: new Date().toISOString(),
      };
      await DBService.store(STORES.MENUISERIE, updated);
      setModal({ type: null });
      loadData();
    } catch (error) {
      console.error('Erreur modification bon:', error);
      alert("Erreur lors de la modification du bon.");
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

  const filtered = orders.filter((o) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      (o.client_name || '').toLowerCase().includes(term) ||
      (o.address || '').toLowerCase().includes(term) ||
      (o.reference || '').toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesType = typeFilter === 'all' || o.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = {
    total: orders.length,
    todo: orders.filter((o) => o.status === 'todo').length,
    inProgress: orders.filter((o) => o.status === 'in_progress').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gray-800">Menuiserie</h1>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" /> Nouveau bon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">Total</p><p className="text-2xl font-bold text-gray-800">{stats.total}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">À faire</p><p className="text-2xl font-bold text-gray-600">{stats.todo}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">En cours</p><p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p></div>
        <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">Terminés</p><p className="text-2xl font-bold text-green-600">{stats.completed}</p></div>
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
          {Object.entries(MENUISERIE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-lg shadow divide-y">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-500">Aucun bon ne correspond.</div>
        )}
        {filtered.map((order) => (
          <div key={order.id} className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-800">{order.client_name || 'Client non renseigné'}</span>
                {order.reference && <span className="text-xs text-gray-400">({order.reference})</span>}
                <span className={`px-2 py-0.5 rounded-full text-xs ${MENUISERIE_STATUS_STYLES[order.status] || ''}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <p className="text-sm text-blue-600">{typeLabel(order.type)}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                {order.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{order.address}</span>}
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {order.assigned_profile?.Name || 'Non assigné'}
                </span>
                {order.scheduled_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(order.scheduled_date).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
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
        ))}
      </div>

      {modal.type === 'create' && (
        <Modal title="Nouveau bon de menuiserie" onClose={() => setModal({ type: null })}>
          <OrderForm menuisiers={menuisiers} onSubmit={handleCreate} onCancel={() => setModal({ type: null })} />
        </Modal>
      )}
      {modal.type === 'edit' && (
        <Modal title="Modifier le bon" onClose={() => setModal({ type: null })}>
          <OrderForm order={modal.data} menuisiers={menuisiers} onSubmit={handleEdit} onCancel={() => setModal({ type: null })} />
        </Modal>
      )}
      {modal.type === 'detail' && (
        <Modal title={modal.data.client_name || 'Détail du bon'} onClose={() => setModal({ type: null })} wide>
          <OrderDetail order={modal.data} />
        </Modal>
      )}
    </div>
  );
}

export default MenuiserieManagement;
