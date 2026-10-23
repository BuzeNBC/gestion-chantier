import React, { useState } from 'react';
import {
  Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption,
} from '@headlessui/react';
import { Plus, Trash2, ChevronsUpDown, Check } from 'lucide-react';
import { sortInterventionOptions } from '../../services/menuiserieService';

// Normalisation pour la recherche : minuscules et sans accents.
const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase();

// Menu déroulant avec recherche : on tape quelques lettres et la liste se
// filtre (insensible à la casse et aux accents).
const InterventionCombobox = ({ value, onChange, options }) => {
  const [query, setQuery] = useState('');
  const filtered = query.trim() === ''
    ? options
    : options.filter((o) => norm(o).includes(norm(query)));

  return (
    <Combobox
      value={value || null}
      onChange={(v) => onChange(v || '')}
      onClose={() => setQuery('')}
      immediate
    >
      <div className="relative">
        <ComboboxInput
          className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          displayValue={(v) => v || ''}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une intervention…"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
          <ChevronsUpDown className="h-4 w-4" />
        </ComboboxButton>
        <ComboboxOptions className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg bg-white border border-gray-200 shadow-lg text-sm">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-gray-400 italic">
              Aucune intervention trouvée. Coche « Nouvelle ? » pour la créer.
            </div>
          ) : (
            filtered.map((opt) => (
              <ComboboxOption
                key={opt}
                value={opt}
                className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer data-[focus]:bg-blue-50 data-[selected]:font-semibold"
              >
                <span>{opt}</span>
                {value === opt && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
};

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
        // Préserver le type déjà choisi si entre-temps il n'est plus dans la
        // liste, en le reclassant à sa place alphabétique.
        const choices = line.type && !interventionOptions.includes(line.type)
          ? sortInterventionOptions([line.type, ...interventionOptions])
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
              <InterventionCombobox
                value={line.type}
                onChange={(v) => update(line.lineId, { type: v })}
                options={choices}
              />
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
