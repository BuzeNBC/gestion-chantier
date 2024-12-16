import React, { useState, useEffect, memo } from 'react';
import { Plus, Edit, Trash, Search, X, Upload } from 'lucide-react';
import { DBService, STORES, generateUUID } from '../services/dbService';
import { Modal } from './Modal';
import TaskImporter from './TaskImporter';


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

const TradeForm = memo(({ trade, onSubmit, onCancel, tradeCategories }) => {
  const [formData, setFormData] = useState(trade || { 
    name: '', 
    category: 'Installation',
    tasks: [] 
  });

  const [newTask, setNewTask] = useState('');

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    setFormData({
      ...formData,
      tasks: [...formData.tasks, newTask.trim()]
    });
    setNewTask('');
  };

  const handleRemoveTask = (index) => {
    setFormData({
      ...formData,
      tasks: formData.tasks.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = () => {
    if (!formData.name) {
      alert('Veuillez saisir un nom pour le corps d\'état');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="trade-name" className="block text-sm font-medium mb-1">Nom</label>
        <input
          type="text"
          id="trade-name"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="trade-category" className="block text-sm font-medium mb-1">Catégorie</label>
        <select
          id="trade-category"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        >
          {tradeCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tâches</label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddTask();
                }
              }}
              placeholder="Nouvelle tâche"
            />
            <button
              onClick={handleAddTask}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Ajouter
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2">
            {formData.tasks.map((task, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <span>{task}</span>
                <button
                  onClick={() => handleRemoveTask(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
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
          {trade ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  );
});

// Composant principal TradesContent
function TradesContent() {
  const [trades, setTrades] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalState, setModalState] = useState({ type: null, data: null });
  const [isLoading, setIsLoading] = useState(true);

  const tradeCategories = ['Installation', 'Rénovation', 'Maintenance'];

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const tradesData = await DBService.getAll(STORES.TRADES);
        setTrades(tradesData || []);
      } catch (error) {
        console.error('Erreur lors du chargement des trades:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);
  
  const getFilteredTrades = () => {
    return trades.filter(trade => {
      const matchesSearch = trade.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.tasks.some(task => task.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || trade.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  };

  const handleAddTrade = async (tradeData) => {
    try {
      const newTrade = {
        ...tradeData,
        id: generateUUID(), // Utiliser UUID au lieu de Date.now()
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
  
      await DBService.store(STORES.TRADES, newTrade);
      setTrades([...trades, newTrade]);
      setModalState({ type: null });
    } catch (error) {
      console.error('Erreur ajout trade:', error);
      alert('Erreur lors de l\'ajout du corps d\'état');
    }
  };

  const handleEditTrade = async (tradeData) => {
    try {
      const updatedTrade = {
        ...trades.find(t => t.id === modalState.data.id),
        ...tradeData
      };

      await DBService.store(STORES.TRADES, updatedTrade);
      setTrades(trades.map(trade =>
        trade.id === modalState.data.id ? updatedTrade : trade
      ));
      setModalState({ type: null });
    } catch (error) {
      console.error('Erreur modification trade:', error);
      alert('Erreur lors de la modification du corps d\'état');
    }
  };

  const handleDeleteTrade = async (tradeId) => {
    try {
      await DBService.delete(STORES.TRADES, tradeId);
      setTrades(trades.filter(trade => trade.id !== tradeId));
      setModalState({ type: null });
    } catch (error) {
      console.error('Erreur suppression trade:', error);
      alert('Erreur lors de la suppression du corps d\'état');
    }
  };

  const handleDeleteTask = async (tradeId, taskIndex) => {
    try {
      const trade = trades.find(t => t.id === tradeId);
      if (!trade) return;

      const updatedTrade = {
        ...trade,
        tasks: trade.tasks.filter((_, index) => index !== taskIndex)
      };

      await DBService.store(STORES.TRADES, updatedTrade);
      setTrades(trades.map(t => t.id === tradeId ? updatedTrade : t));
    } catch (error) {
      console.error('Erreur suppression tâche:', error);
      alert('Erreur lors de la suppression de la tâche');
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
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex-1 max-w-2xl">
          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
        <div className="flex gap-4">
          <select
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Toutes les catégories</option>
            {tradeCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={() => setModalState({ type: 'import-tasks' })}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition duration-300"
          >
            <Upload className="h-5 w-5" />
            Importer des tâches
          </button>
          <button
            onClick={() => setModalState({ type: 'add-trade' })}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition duration-300"
          >
            <Plus className="h-5 w-5" />
            Nouveau corps d'état
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {getFilteredTrades().map(trade => (
          <div key={trade.id} className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">{trade.name}</h2>
                <span className="text-sm text-gray-500">{trade.category}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalState({ 
                    type: 'edit-trade', 
                    data: trade 
                  })}
                  className="text-blue-600 hover:bg-blue-50 p-1 rounded transition duration-300"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setModalState({ 
                    type: 'delete-trade', 
                    data: trade 
                  })}
                  className="text-red-600 hover:bg-red-50 p-1 rounded transition duration-300"
                >
                  <Trash className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {trade.tasks.map((task, index) => (
                <div key={index} className="flex justify-between items-center px-4 py-2 bg-gray-50 rounded-lg">
                  <span>{task}</span>
                  <button
                    onClick={() => handleDeleteTask(trade.id, index)}
                    className="text-red-600 hover:bg-red-50 p-1 rounded opacity-0 hover:opacity-100 transition-opacity duration-300"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {modalState.type === 'add-trade' && (
        <Modal
          title="Nouveau corps d'état"
          onClose={() => setModalState({ type: null })}
        >
          <TradeForm
            tradeCategories={tradeCategories}
            onSubmit={handleAddTrade}
            onCancel={() => setModalState({ type: null })}
          />
        </Modal>
      )}

      {modalState.type === 'edit-trade' && (
        <Modal
          title="Modifier le corps d'état"
          onClose={() => setModalState({ type: null })}
        >
          <TradeForm
            trade={modalState.data}
            tradeCategories={tradeCategories}
            onSubmit={handleEditTrade}
            onCancel={() => setModalState({ type: null })}
          />
        </Modal>
      )}

      {modalState.type === 'delete-trade' && (
        <Modal
          title="Confirmer la suppression"
          onClose={() => setModalState({ type: null })}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Êtes-vous sûr de vouloir supprimer ce corps d'état ?
              Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setModalState({ type: null })}
                className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteTrade(modalState.data.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modalState.type === 'import-tasks' && (
        <Modal
          title="Importer des tâches"
          onClose={() => setModalState({ type: null })}
        >
          <TaskImporter
            onClose={() => setModalState({ type: null })}
            trades={trades}
            tradeCategories={tradeCategories}
          />
        </Modal>
      )}
    </div>
  );
};

export default TradesContent;

