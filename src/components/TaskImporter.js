import React, { useState, useEffect } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { DBService, STORES } from '../services/dbService';

const TaskImporter = ({ onClose }) => {
  const [file, setFile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [trades, setTrades] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState('');
  const [newTrade, setNewTrade] = useState({
    name: '',
    category: ''
  });
  const [isNewTrade, setIsNewTrade] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadTrades = async () => {
      try {
        const tradesData = await DBService.getAll(STORES.TRADES);
        setTrades(tradesData || []);
      } catch (error) {
        console.error('Erreur chargement corps d\'état:', error);
      }
    };
    loadTrades();
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setFile(file);
      parseCSV(file);
    } else {
      alert('Veuillez sélectionner un fichier CSV');
    }
  };

  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n');
      const parsedTasks = lines
        .filter(line => line.trim())
        .map(line => line.trim())
        .filter((line, index) => index > 0); // Ignorer l'en-tête
      setTasks(parsedTasks);
    };
    reader.readAsText(file);
  };

  const handleTradeSelection = (value) => {
    if (value === 'new') {
      setIsNewTrade(true);
      setSelectedTrade('');
    } else {
      setIsNewTrade(false);
      setSelectedTrade(value);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (tasks.length === 0) {
        throw new Error('Aucune tâche à importer');
      }

      if (isNewTrade) {
        if (!newTrade.name || !newTrade.category) {
          throw new Error('Veuillez remplir tous les champs pour le nouveau corps d\'état');
        }

        // Créer un nouveau corps d'état
        const newTradeData = {
          id: Date.now().toString(),
          name: newTrade.name,
          category: newTrade.category,
          tasks: tasks,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await DBService.store(STORES.TRADES, newTradeData);
      } else {
        if (!selectedTrade) {
          throw new Error('Veuillez sélectionner un corps d\'état');
        }

        // Mettre à jour un corps d'état existant
        const trade = trades.find(t => t.id === selectedTrade);
        const updatedTrade = {
          ...trade,
          tasks: [...(trade.tasks || []), ...tasks],
          updated_at: new Date().toISOString()
        };

        await DBService.store(STORES.TRADES, updatedTrade);
      }

      alert('Import réussi !');
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      alert(error.message || 'Erreur lors de l\'import');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section d'upload de fichier */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          <Upload className="h-12 w-12 text-gray-400" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Importer un fichier CSV</h3>
            <p className="text-sm text-gray-500">Format attendu: une tâche par ligne</p>
            <p className="text-xs text-gray-400">
              Exemple de fichier:
              <br />
              tache
              <br />
              "Installation des prises"
              <br />
              "Raccordement tableau électrique"
            </p>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
      </div>

      {/* Liste des tâches importées */}
      {tasks.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium">Tâches à importer ({tasks.length})</h4>
          <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
            {tasks.map((task, index) => (
              <div key={index} className="py-1 px-2 odd:bg-gray-50">
                {task}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sélection du corps d'état */}
      {tasks.length > 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Corps d'état</label>
            <select
              value={isNewTrade ? 'new' : selectedTrade}
              onChange={(e) => handleTradeSelection(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Sélectionner un corps d'état</option>
              {trades.map(trade => (
                <option key={trade.id} value={trade.id}>
                  {trade.name} ({trade.category})
                </option>
              ))}
              <option value="new">+ Nouveau corps d'état</option>
            </select>
          </div>

          {isNewTrade && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nom du nouveau corps d'état</label>
                <input
                  type="text"
                  value={newTrade.name}
                  onChange={(e) => setNewTrade({ ...newTrade, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: Électricité"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Catégorie</label>
                <input
                  type="text"
                  value={newTrade.category}
                  onChange={(e) => setNewTrade({ ...newTrade, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: Second œuvre"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex justify-end gap-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100"
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading || tasks.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isLoading ? 'Import en cours...' : 'Importer'}
        </button>
      </div>
    </div>
  );
};

export default TaskImporter;