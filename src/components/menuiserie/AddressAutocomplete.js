import React, { useRef, useState } from 'react';
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/react';
import { MapPin, MapPinOff, Loader2 } from 'lucide-react';
import { searchAddress } from '../../services/geocodingService';
import { hasCoords } from '../../services/geoUtils';

// Champ adresse avec suggestions de l'API Adresse (BAN). La saisie libre est
// conservée telle quelle ; choisir une suggestion normalise l'adresse ET
// fournit les coordonnées GPS (onSelect). Si rien n'est choisi, le
// formulaire tentera un géocodage à l'enregistrement.
//
// Props : value (texte), onChange(texte), onSelect(hit), geo (objet avec
// latitude/longitude/geocode_address/geocoded_at pour la ligne d'état).
const AddressAutocomplete = ({ value, onChange, onSelect, geo, placeholder = '12 rue des Lilas, 59000 Lille' }) => {
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const handleInput = (text) => {
    onChange(text);
    clearTimeout(timerRef.current);
    abortRef.current?.abort();
    if (text.trim().length < 3) {
      setHits([]);
      setLoading(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await searchAddress(text, { limit: 5, signal: ctrl.signal });
        if (!ctrl.signal.aborted) setHits(res);
      } catch (e) {
        if (!ctrl.signal.aborted) setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
  };

  const trimmed = String(value || '').trim();
  const localized = hasCoords(geo) && String(geo.geocode_address || '') === trimmed;
  const failed = !hasCoords(geo) && geo?.geocoded_at && String(geo.geocode_address || '') === trimmed;

  return (
    <Combobox
      value={value || ''}
      onChange={(hit) => {
        if (hit && typeof hit === 'object') {
          setHits([]);
          onSelect?.(hit);
        }
      }}
    >
      <div className="relative">
        <ComboboxInput
          className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          displayValue={() => value || ''}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <span className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 pointer-events-none">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </span>
        {hits.length > 0 && (
          <ComboboxOptions className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg bg-white border border-gray-200 shadow-lg text-sm">
            {hits.map((hit) => (
              <ComboboxOption
                key={`${hit.lat},${hit.lng},${hit.label}`}
                value={hit}
                className="px-3 py-2 cursor-pointer data-[focus]:bg-blue-50"
              >
                <div className="font-medium text-gray-800">{hit.label}</div>
                {hit.type && hit.type !== 'housenumber' && (
                  <div className="text-xs text-gray-400">
                    {hit.type === 'street' ? 'Rue (sans numéro)' : hit.type === 'municipality' ? 'Commune seulement' : hit.type}
                  </div>
                )}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        )}
      </div>
      {trimmed && (
        <p className={`mt-1 text-xs flex items-center gap-1 ${
          localized ? 'text-green-700' : failed ? 'text-amber-700' : 'text-gray-500'
        }`}>
          {localized ? (
            <><MapPin className="h-3 w-3" /> Localisée : {geo.geocode_label || trimmed}</>
          ) : failed ? (
            <><MapPinOff className="h-3 w-3" /> Adresse non localisée — précise le numéro, la rue et la ville, ou choisis une suggestion.</>
          ) : (
            <><MapPin className="h-3 w-3" /> Choisis une suggestion pour localiser le chantier (sinon tentative automatique à l'enregistrement).</>
          )}
        </p>
      )}
    </Combobox>
  );
};

export default AddressAutocomplete;
