import React, { useState, useEffect, memo } from 'react';
import { 
  Plus, 
  Edit, 
  Trash, 
  ListPlus, 
  Search, 
  X, 
  CheckCircle, 
  AlertCircle,
  Filter,    // Ajouté
  ChevronDown // Ajouté
} from 'lucide-react';
import { DBService, compressImage, STORES } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

// Composants réutilisables
const Modal = memo(({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition duration-300"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      {children}
    </div>
  </div>
));

const SearchBar = memo(({ searchTerm, onSearchChange }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
    <input
      type="text"
      placeholder="Rechercher..."
      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      value={searchTerm}
      onChange={(e) => onSearchChange(e.target.value)}
    />
  </div>
));

const TaskForm = memo(({ onSubmit, onCancel, trades }) => {
  const [formData, setFormData] = useState({
    selectedTrade: '',
    selectedTask: '',
    customTask: '',
    isCustomTask: false,
    searchTerm: '',
    selectedRoom: '',
    customRoom: '',
    isCustomRoom: false,
    measureType: 'square_meters',
    customMeasureType: '',
    isCustomMeasureType: false,
    quantity: ''
  });
  
  const defaultRooms = [
    'Salon', 'Cuisine', 'Salle de bain', 'Chambre 1', 'Chambre 2', 
    'WC', 'Entrée', 'Garage', 'Extérieur', 'Cave', 'Buanderie'
  ];

  const filteredTasks = trades.find(trade => 
    trade.id.toString() === formData.selectedTrade
  )?.tasks.filter(task => 
    task.toLowerCase().includes(formData.searchTerm.toLowerCase())
  ) || [];

  const handleSubmit = () => {
    const taskDescription = formData.isCustomTask ? formData.customTask : formData.selectedTask;
    const roomName = formData.isCustomRoom ? formData.customRoom : formData.selectedRoom;
    const measureType = formData.isCustomMeasureType ? formData.customMeasureType : formData.measureType;
    
    if (!formData.selectedTrade || !taskDescription || !roomName || 
        (!formData.isCustomMeasureType && !formData.measureType) || 
        (formData.isCustomMeasureType && !formData.customMeasureType)) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const taskData = {
      description: taskDescription,
      tradeId: formData.selectedTrade,
      room: roomName,
      completed: false,
      isCustom: formData.isCustomTask,
      measureType: measureType,
      isCustomMeasureType: formData.isCustomMeasureType,
      quantity: parseFloat(formData.quantity) || null
    };

    onSubmit(taskData);
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="space-y-4">
      {/* Corps d'état */}
      <div>
        <label className="block text-sm font-medium mb-1">Corps d'état</label>
        <select
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          value={formData.selectedTrade}
          onChange={(e) => handleInputChange('selectedTrade', e.target.value)}
        >
          <option value="">Sélectionner un corps d'état</option>
          {trades.map(trade => (
            <option key={trade.id} value={trade.id}>{trade.name}</option>
          ))}
        </select>
      </div>

      {/* Type de mesure avec option personnalisée */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="custom-measure"
            checked={formData.isCustomMeasureType}
            onChange={(e) => {
              handleInputChange('isCustomMeasureType', e.target.checked);
              if (e.target.checked) {
                handleInputChange('measureType', '');
              } else {
                handleInputChange('customMeasureType', '');
                handleInputChange('measureType', 'square_meters');
              }
            }}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="custom-measure" className="text-sm text-gray-600">
            Créer un nouveau type de mesure
          </label>
        </div>

        {formData.isCustomMeasureType ? (
          <input
            type="text"
            placeholder="Ex: Mètre cube (m³)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            value={formData.customMeasureType}
            onChange={(e) => handleInputChange('customMeasureType', e.target.value)}
          />
        ) : (
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            value={formData.measureType}
            onChange={(e) => handleInputChange('measureType', e.target.value)}
          >
            <option value="square_meters">Mètres carrés (m²)</option>
            <option value="linear_meters">Mètre Linéaire (ml)</option>
            <option value="units">Unités</option>
            <option value="fixed_price">Forfait</option>
          </select>
        )}
      </div>

      {/* Section Pièce avec option personnalisée */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="custom-room"
            checked={formData.isCustomRoom}
            onChange={(e) => {
              handleInputChange('isCustomRoom', e.target.checked);
              if (e.target.checked) {
                handleInputChange('selectedRoom', '');
              } else {
                handleInputChange('customRoom', '');
              }
            }}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="custom-room" className="text-sm text-gray-600">
            Créer une nouvelle pièce
          </label>
        </div>

        {formData.isCustomRoom ? (
          <input
            type="text"
            placeholder="Nom de la nouvelle pièce"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            value={formData.customRoom}
            onChange={(e) => handleInputChange('customRoom', e.target.value)}
          />
        ) : (
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            value={formData.selectedRoom}
            onChange={(e) => handleInputChange('selectedRoom', e.target.value)}
          >
            <option value="">Sélectionner une pièce</option>
            {defaultRooms.map(room => (
              <option key={room} value={room}>{room}</option>
            ))}
          </select>
        )}
      </div>

      {/* Quantité - toujours affichée */}
      {(
        <div>
          <label className="block text-sm font-medium mb-1">
            {formData.isCustomMeasureType ? `Quantité (${formData.customMeasureType})` :
             formData.measureType === 'square_meters' ? 'Surface en m²' :
             formData.measureType === 'linear_meters' ? 'Longueur en ml' :
             formData.measureType === 'fixed_price' ? 'Montant forfaitaire (€)' :
             'Nombre d\'unités'}
          </label>
          <input
            type="number"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            value={formData.quantity}
            onChange={(e) => handleInputChange('quantity', e.target.value)}
            min="0"
            step={formData.measureType === 'square_meters' || formData.measureType === 'linear_meters' ? "0.01" : "1"}
          />
        </div>
      )}

      {/* Choix entre tâche existante ou personnalisée */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          id="custom-task"
          checked={formData.isCustomTask}
          onChange={(e) => {
            handleInputChange('isCustomTask', e.target.checked);
            if (e.target.checked) {
              handleInputChange('selectedTask', '');
              handleInputChange('searchTerm', '');
            } else {
              handleInputChange('customTask', '');
            }
          }}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="custom-task" className="text-sm text-gray-600">
          Créer une nouvelle tâche
        </label>
      </div>

      {formData.isCustomTask ? (
        <div>
          <label className="block text-sm font-medium mb-1">
            Description de la nouvelle tâche
          </label>
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            value={formData.customTask}
            onChange={(e) => handleInputChange('customTask', e.target.value)}
            placeholder="Entrez la description de la tâche"
          />
        </div>
      ) : (
        <>
          {/* Recherche de tâches */}
          {formData.selectedTrade && (
            <div>
              <label className="block text-sm font-medium mb-1">Rechercher une tâche</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                  value={formData.searchTerm}
                  onChange={(e) => handleInputChange('searchTerm', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Sélection de la tâche */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Tâche prédéfinie
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              value={formData.selectedTask}
              onChange={(e) => handleInputChange('selectedTask', e.target.value)}
              disabled={!formData.selectedTrade}
            >
              <option value="">Sélectionner une tâche</option>
              {filteredTasks.map((task, index) => (
                <option key={index} value={task}>{task}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Boutons d'action */}
      <div className="flex justify-end gap-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
});

const SiteForm = memo(({ site, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(site || {
    name: '',
    address: '',
    startDate: new Date().toISOString().split('T')[0],
    status: 'planned',
    tasks: []
  });

  const [workers, setWorkers] = useState([]);

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const { data: workersData, error } = await supabase
          .from('profiles')
          .select('id, Name, role')
          .eq('role', 'worker');

        if (error) throw error;
        setWorkers(workersData || []);
      } catch (error) {
        console.error('Erreur lors du chargement des ouvriers:', error);
      }
    };

    fetchWorkers();
  }, []);

  const handleSubmit = () => {
    if (!formData.name || !formData.address) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="site-name" className="block text-sm font-medium mb-1">Nom du chantier</label>
        <input
          type="text"
          id="site-name"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="site-address" className="block text-sm font-medium mb-1">Adresse</label>
        <input
          type="text"
          id="site-address"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="site-start-date" className="block text-sm font-medium mb-1">Date de début</label>
        <input
          type="date"
          id="site-start-date"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.startDate}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="site-status" className="block text-sm font-medium mb-1">Statut</label>
        <select
          id="site-status"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        >
          <option value="planned">Planifié</option>
          <option value="in-progress">En cours</option>
          <option value="completed">Terminé</option>
        </select>
      </div>

      <div className="flex justify-end gap-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100 transition duration-300"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
        >
          {site ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  );
});

// Composant principal SiteManagement
const SiteManagement = () => {
  const [sites, setSites] = useState([]);
  const [trades, setTrades] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalState, setModalState] = useState({ type: null, data: null });
  const [isLoading, setIsLoading] = useState(true);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: 'all',
    tradeType: 'all'
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Récupérer les données de Supabase
        const { data: sitesData, error: sitesError } = await supabase
          .from('sites')
          .select(`
            *,
            profiles:worker_id(
              id,
              Name
            )
          `)
          .not('status', 'eq', 'completed');
  
        if (sitesError) throw sitesError;
        
        // Récupérer les trades
        const tradesData = await DBService.getAll(STORES.TRADES);
  
        // S'assurer que sitesData est un tableau
        setSites(Array.isArray(sitesData) ? sitesData : []);
        setTrades(tradesData || []);
        
      } catch (error) {
        console.error('Erreur chargement données:', error);
      } finally {
        setIsLoading(false);
      }
    };
  
    loadData();
  }, []);

  const getFilteredSites = () => {
    if (!Array.isArray(sites)) return [];
    
    return sites.filter(site => {
      const matchesSearch = (
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.tasks?.some(task => task.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  
      const matchesStatus = filters.status === 'all' || site.status === filters.status;
      
      const matchesDate = filters.dateRange === 'all' || (() => {
        const siteDate = new Date(site.startDate);
        const now = new Date();
        switch(filters.dateRange) {
          case 'week':
            const weekAgo = new Date(now.setDate(now.getDate() - 7));
            return siteDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
            return siteDate >= monthAgo;
          case 'quarter':
            const quarterAgo = new Date(now.setMonth(now.getMonth() - 3));
            return siteDate >= quarterAgo;
          default:
            return true;
        }
      })();
  
      const matchesTrade = filters.tradeType === 'all' || 
        site.tasks?.some(task => task.tradeId === filters.tradeType);
  
      return matchesSearch && matchesStatus && matchesDate && matchesTrade;
    });
  };
  
  const handleAddSite = async (siteData) => {
    try {
      const newSite = {
        ...siteData,
        id: Date.now().toString(),
        tasks: []
      };

      await DBService.store(STORES.SITES, newSite);
      setSites([...sites, newSite]);
      setModalState({ type: null });
    } catch (error) {
      console.error('Erreur ajout site:', error);
      alert('Erreur lors de l\'ajout du chantier');
    }
  };

  const handleEditSite = async (siteData) => {
    try {
      const updatedSite = {
        ...sites.find(s => s.id === modalState.data.id),
        ...siteData
      };

      await DBService.store(STORES.SITES, updatedSite);
      setSites(sites.map(site =>
        site.id === modalState.data.id.toString() ? updatedSite : site
      ));
      setModalState({ type: null });
    } catch (error) {
      console.error('Erreur modification site:', error);
      alert('Erreur lors de la modification du chantier');
    }
  };

  const handleDeleteSite = async (siteId) => {
    try {
      const site = sites.find(s => s.id === siteId.toString());
      if (site) {
        for (const task of site.tasks) {
          if (task.photoId) {
            await DBService.delete(STORES.PHOTOS, task.photoId);
          }
        }
      }

      await DBService.delete(STORES.SITES, siteId.toString());
      setSites(sites.filter(site => site.id !== siteId.toString()));
      setModalState({ type: null });
    } catch (error) {
      console.error('Erreur suppression site:', error);
      alert('Erreur lors de la suppression du chantier');
    }
  };

  const handleAddTask = async (siteId, taskData) => {
    try {
      const site = sites.find(s => s.id === siteId);
      if (!site) return;
  
      const updatedSite = {
        ...site,
        tasks: [
          ...site.tasks,
          {
            ...taskData,
            id: Date.now().toString(),
            completed: false,
            room: taskData.room // Ajout de la pièce
          }
        ]
      };

      await DBService.store(STORES.SITES, updatedSite);
      setSites(sites.map(s => s.id === siteId ? updatedSite : s));
      setModalState({ type: null });
    } catch (error) {
      console.error('Erreur ajout tâche:', error);
      alert('Erreur lors de l\'ajout de la tâche');
    }
  };

  // Ajouter après handleAddTask
const handleDeleteTask = async (siteId, taskId) => {
  if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
    return;
  }

  try {
    // Trouver le site et la tâche
    const site = sites.find(s => s.id === siteId);
    if (!site) return;

    // Si la tâche a des photos, les supprimer du storage
    const task = site.tasks.find(t => t.id === taskId);
    if (task?.photos?.length > 0) {
      for (const photo of task.photos) {
        const fileName = photo.url.split('/').pop();
        await supabase.storage
          .from('photos')
          .remove([`public/photos/${fileName}`]);
      }
    }

    // Créer le site mis à jour sans la tâche
    const updatedSite = {
      ...site,
      tasks: site.tasks.filter(task => task.id !== taskId)
    };

    // Mettre à jour dans Supabase
    const { error } = await supabase
      .from('sites')
      .update({ tasks: updatedSite.tasks })
      .eq('id', siteId);

    if (error) throw error;

    // Mettre à jour l'état local
    setSites(sites.map(s => s.id === siteId ? updatedSite : s));
  } catch (error) {
    console.error('Erreur lors de la suppression de la tâche:', error);
    alert('Erreur lors de la suppression de la tâche');
  }
};

const handleCompleteSite = async (siteId) => {
  try {
    const { error } = await supabase
      .from('sites')
      .update({
        status: 'completed',
        completeddate: new Date().toISOString()
      })
      .eq('id', siteId);

    if (error) throw error;
    
    // Retirer immédiatement le site de la liste locale
    setSites(prevSites => prevSites.filter(site => site.id !== siteId));
    
  } catch (error) {
    console.error('Error:', error);
    alert(`Erreur: ${error.message}`);
  }
};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Barre de recherche et bouton d'ajout */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex-1 max-w-2xl">
          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
        <button
          onClick={() => setModalState({ type: 'add-site' })}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition duration-300"
        >
          <Plus className="h-5 w-5" />
          Nouveau chantier
        </button>
      </div>
      <button
  onClick={() => setFilterVisible(!filterVisible)}
  className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-300"
>
  <Filter className="h-5 w-5" />
  Filtres
  <ChevronDown className={`h-4 w-4 transform transition-transform duration-300 ${filterVisible ? 'rotate-180' : ''}`} />
</button>

{filterVisible && (
  <div className="bg-white p-4 rounded-lg shadow-md mb-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Statut
        </label>
        <select 
          className="w-full p-2 border rounded-lg"
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        >
          <option value="all">Tous les statuts</option>
          <option value="planned">Planifiés</option>
          <option value="in-progress">En cours</option>
          <option value="completed">Terminés</option>
        </select>
      </div>
      
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Période
        </label>
        <select 
          className="w-full p-2 border rounded-lg"
          value={filters.dateRange}
          onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
        >
          <option value="all">Toutes les périodes</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
          <option value="quarter">Ce trimestre</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Corps d'état
        </label>
        <select 
          className="w-full p-2 border rounded-lg"
          value={filters.tradeType}
          onChange={(e) => setFilters({...filters, tradeType: e.target.value})}
        >
          <option value="all">Tous les corps d'état</option>
          {trades.map(trade => (
            <option key={trade.id} value={trade.id}>{trade.name}</option>
          ))}
        </select>
      </div>
    </div>
  </div>
)}

      {/* Liste des chantiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {getFilteredSites().map(site => (
          <div key={site.id} className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">{site.name}</h2>
                <p className="text-sm text-gray-500">{site.address}</p>
                <p className="text-sm text-gray-500">
                  Début: {new Date(site.startDate).toLocaleDateString()}
                </p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                  site.status === 'completed' ? 'bg-green-100 text-green-800' :
                  site.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {site.status === 'completed' ? 'Terminé' :
                   site.status === 'in-progress' ? 'En cours' : 'Planifié'}
                </span>
              </div>
            <div className="flex gap-2">
              <button
                onClick={() => setModalState({ 
                  type: 'add-task', 
                  data: { siteId: site.id } 
                })}
                className="text-green-600 hover:bg-green-50 p-1 rounded transition duration-300"
              >
                <ListPlus className="h-5 w-5" />
              </button>
              <button
                onClick={() => setModalState({ 
                  type: 'edit-site', 
                  data: site 
                })}
                className="text-blue-600 hover:bg-blue-50 p-1 rounded transition duration-300"
              >
                <Edit className="h-5 w-5" />
              </button>
              <button
                onClick={() => setModalState({ 
                  type: 'delete-site', 
                  data: site 
                })}
                className="text-red-600 hover:bg-red-50 p-1 rounded transition duration-300"
              >
                <Trash className="h-5 w-5" />
              </button>
              {site.status !== 'completed' && (
    <button
      onClick={() => handleCompleteSite(site.id)}
      className="text-green-600 hover:bg-green-50 p-1 rounded transition duration-300"
      title="Marquer comme terminé"
    >
      <CheckCircle className="h-5 w-5" />
    </button>
  )}
            </div>
          </div>
          <div className="mt-4">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium text-gray-700">Progression</span>
      <span className="text-sm font-medium text-gray-700">
        {site.tasks?.filter(task => task.completed).length || 0}/{site.tasks?.length || 0}
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className="bg-blue-600 rounded-full h-2 transition-all duration-500"
        style={{ 
          width: `${site.tasks?.length ? 
            (site.tasks.filter(task => task.completed).length / site.tasks.length * 100) : 0}%` 
        }}
      />
    </div>
  </div>

          {/* Liste des tâches */}
         {/* Liste des tâches groupées par pièce */}
<div className="space-y-4">
  {Object.entries(
    site.tasks.reduce((acc, task) => {
      const room = task.room || 'Non assigné';
      if (!acc[room]) acc[room] = [];
      acc[room].push(task);
      return acc;
    }, {})
  ).map(([room, tasks]) => (
    <div key={room} className="space-y-2">
      <h3 className="font-medium text-gray-700 px-4">{room}</h3>
      {tasks.map((task) => (
  <div key={task.id} className="flex justify-between items-center px-4 py-2 bg-gray-50 rounded-lg">
    <div>
      <p className="font-medium">{task.description}</p>
      <p className="text-sm text-gray-500">
        {trades.find(t => t.id.toString() === task.tradeId)?.name}
      </p>
    </div>
    <div className="flex items-center gap-2">
      {task.completed ? (
        <div className="flex items-center text-green-600">
          <CheckCircle className="h-5 w-5" />
        </div>
      ) : (
        <div className="flex items-center text-orange-600">
          <AlertCircle className="h-5 w-5" />
        </div>
      )}
      <button
        onClick={() => handleDeleteTask(site.id, task.id)}
        className="text-red-600 hover:bg-red-50 p-1 rounded-full transition-colors duration-200"
        title="Supprimer la tâche"
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  </div>
))}
    </div>
  ))}
</div>
        </div>
      ))}
    </div>

    {/* Modales */}
    {modalState.type === 'add-site' && (
      <Modal
        title="Nouveau chantier"
        onClose={() => setModalState({ type: null })}
      >
        <SiteForm
          onSubmit={handleAddSite}
          onCancel={() => setModalState({ type: null })}
        />
      </Modal>
    )}

    {modalState.type === 'edit-site' && (
      <Modal
        title="Modifier le chantier"
        onClose={() => setModalState({ type: null })}
      >
        <SiteForm
          site={modalState.data}
          onSubmit={handleEditSite}
          onCancel={() => setModalState({ type: null })}
        />
      </Modal>
    )}

    {modalState.type === 'add-task' && (
      <Modal
        title="Ajouter une tâche"
        onClose={() => setModalState({ type: null })}
      >
        <TaskForm
          trades={trades}
          onSubmit={(taskData) => handleAddTask(modalState.data.siteId, taskData)}
          onCancel={() => setModalState({ type: null })}
        />
      </Modal>
    )}

    {modalState.type === 'delete-site' && (
      <Modal
        title="Confirmer la suppression"
        onClose={() => setModalState({ type: null })}
      >
        <div className="space-y-4">
          <p>Êtes-vous sûr de vouloir supprimer ce chantier ?</p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setModalState({ type: null })}
              className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              onClick={() => handleDeleteSite(modalState.data.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Supprimer
            </button>
          </div>
        </div>
      </Modal>
    )}
  </div>
);
};

export default SiteManagement;