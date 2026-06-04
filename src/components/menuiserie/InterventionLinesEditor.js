import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

// Éditeur des lignes d'intervention dans le formulaire admin "Nouveau bon".
// Une ligne = un choix de type (dropdown depuis le corps d'état Menuiserie),
// ou un texte libre si l'admin coche "Nouvelle ?" pour créer une intervention
// inédite (qui sera ajoutée aux tâches du corps d'état au submit).
//
// Forme d'un item dans `lines` :
//   { lineId, type, customMode, customText }
// `lineId` est un id local (uniquement pour les keys React) ; le UUID
// définitif de l'intervention est généré côté parent au moment du submit.
function InterventionLinesEditor({ lines, onChange, interventionOptions }) {
  const update = (lineId, patch) => {
    onChange(lines.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)));
  };

  const remove = (lineId) => {
    onChange(lines.filter((l) => l.lineId !== lineId));
  };

  const add = () => {
    onChange([
      ...lines,
      {
        lineId: 'l-' + Math.random().toString(36).slice(2),
        type: '',
        customMode: false,
        customText: '',
      },
    ]);
  };

  return (
    <div className="space-y-2">
      {lines.length === 0 && (
        <p className="text-xs text-gray-400 italic">Ajoutez au moins une intervention.</p>
      )}

      {lines.map((line, idx) => {
        // Préserver le type déjà choisi si entre-temps il n'est plus dans la liste
        const choices = line.type && !interventionOptions.includes(line.type)
          ? [line.type, ...interventionOptions]
          : interventionOptions;
        return (
          <div key={line.lineId} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Intervention #{idx + 1}</span>
              <div className="flex items-center gap-3">
                {choices.length > 0 && (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={line.customMode}
                      onChange={(e) =>
                        update(line.lineId, {
                          customMode: e.target.checked,
                          customText: e.target.checked ? '' : line.customText,
                        })
                      }
                      className="h-3.5 w-3.5"
                    />
                    Nouvelle ?
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => remove(line.lineId)}
                  className="text-red-500 hover:text-red-700"
                  aria-label="Retirer l'intervention"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {line.customMode || choices.length === 0 ? (
              <input
                type="text"
                value={line.customMode ? line.customText : line.type}
                onChange={(e) =>
                  update(
                    line.lineId,
                    line.customMode ? { customText: e.target.value } : { type: e.target.value },
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                placeholder="Ex: Remplacement charnière porte d'entrée"
              />
            ) : (
              <select
                value={line.type}
                onChange={(e) => update(line.lineId, { type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="">— Choisir une intervention —</option>
                {choices.map((task) => (
                  <option key={task} value={task}>{task}</option>
                ))}
              </select>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
      >
        <Plus className="h-4 w-4" /> Ajouter une intervention
      </button>
    </div>
  );
}

export default InterventionLinesEditor;
