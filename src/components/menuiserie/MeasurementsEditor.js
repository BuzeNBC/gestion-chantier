import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { OUVRANT_TYPES } from '../../services/menuiserieService';
import { generateUUID } from '../../services/dbService';

// Éditeur de cotes : tableau de relevés { id, repere, largeur, hauteur, ouvrant, notes }.
// `readOnly` permet d'afficher les cotes sans permettre l'édition (vue admin).
function MeasurementsEditor({ measurements = [], onChange, readOnly = false }) {
  const updateRow = (id, field, value) => {
    onChange(measurements.map(m => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const addRow = () => {
    onChange([
      ...measurements,
      { id: generateUUID(), repere: '', largeur: '', hauteur: '', ouvrant: OUVRANT_TYPES[0], notes: '' },
    ]);
  };

  const removeRow = (id) => {
    onChange(measurements.filter(m => m.id !== id));
  };

  if (readOnly && measurements.length === 0) {
    return <p className="text-sm text-gray-400 italic">Aucune cote relevée.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-2 font-medium">Repère / Pièce</th>
              <th className="py-2 px-2 font-medium">Largeur (mm)</th>
              <th className="py-2 px-2 font-medium">Hauteur (mm)</th>
              <th className="py-2 px-2 font-medium">Ouvrant</th>
              <th className="py-2 px-2 font-medium">Notes</th>
              {!readOnly && <th className="py-2 pl-2 w-10" />}
            </tr>
          </thead>
          <tbody>
            {measurements.map((m) => (
              <tr key={m.id} className="border-b last:border-b-0">
                <td className="py-2 pr-2">
                  {readOnly ? (
                    <span>{m.repere || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      value={m.repere}
                      onChange={(e) => updateRow(m.id, 'repere', e.target.value)}
                      placeholder="Ex: Cuisine F1"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </td>
                <td className="py-2 px-2">
                  {readOnly ? (
                    <span>{m.largeur || '—'}</span>
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={m.largeur}
                      onChange={(e) => updateRow(m.id, 'largeur', e.target.value)}
                      placeholder="0"
                      className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </td>
                <td className="py-2 px-2">
                  {readOnly ? (
                    <span>{m.hauteur || '—'}</span>
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={m.hauteur}
                      onChange={(e) => updateRow(m.id, 'hauteur', e.target.value)}
                      placeholder="0"
                      className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </td>
                <td className="py-2 px-2">
                  {readOnly ? (
                    <span>{m.ouvrant || '—'}</span>
                  ) : (
                    <select
                      value={m.ouvrant}
                      onChange={(e) => updateRow(m.id, 'ouvrant', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {OUVRANT_TYPES.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-2 px-2">
                  {readOnly ? (
                    <span>{m.notes || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      value={m.notes}
                      onChange={(e) => updateRow(m.id, 'notes', e.target.value)}
                      placeholder="Remarque"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="py-2 pl-2">
                    <button
                      type="button"
                      onClick={() => removeRow(m.id)}
                      className="text-red-500 hover:text-red-700"
                      aria-label="Supprimer la ligne"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          <Plus className="h-4 w-4" />
          Ajouter une cote
        </button>
      )}
    </div>
  );
}

export default MeasurementsEditor;
