import React from 'react';
import { Loader2, MapPin, MapPinOff, AlertTriangle } from 'lucide-react';
import { describeDbError } from '../../services/dbErrors';

// Bandeau de la localisation automatique (cf. useAutoGeocode / backfillGeocoding).
// En cas d'erreur, affiche la cause réelle et quoi faire.
const errorHint = (progress) => {
  const msg = progress.lastError || '';
  if (progress.lastErrorSource === 'db') {
    return `La base refuse l'écriture des coordonnées — ${describeDbError(msg)}`;
  }
  if (/abort|timeout|Failed to fetch|NetworkError|indisponible/i.test(msg)) {
    return 'Le service de géocodage ne répond pas (connexion ou pare-feu). Réessaie plus tard.';
  }
  return 'Erreur pendant la localisation.';
};

export default function GeocodeProgress({ progress, className = '' }) {
  if (!progress) return null;
  if (!progress.finished && !progress.aborted) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
        Localisation des adresses… {progress.done}/{progress.total}
      </div>
    );
  }
  if (progress.errors) {
    return (
      <div className={`px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-1 ${className}`}>
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Localisation interrompue : {progress.ok} réussie{progress.ok > 1 ? 's' : ''}, {progress.errors} en erreur
          {progress.aborted ? ` (arrêt après 3 échecs consécutifs, ${progress.total - progress.done} non tentée${progress.total - progress.done > 1 ? 's' : ''})` : ''}.
        </p>
        <p>{errorHint(progress)}</p>
        {progress.lastError && (
          <p className="font-mono text-[11px] text-red-700/80 break-all">Détail : {progress.lastError}</p>
        )}
      </div>
    );
  }
  if (progress.ok === 0 && !progress.failed) return null;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-green-50 border border-green-200 text-green-800 ${className}`}>
      {progress.failed ? <MapPinOff className="h-4 w-4 flex-shrink-0" /> : <MapPin className="h-4 w-4 flex-shrink-0" />}
      <span>
        {progress.ok} adresse{progress.ok > 1 ? 's' : ''} localisée{progress.ok > 1 ? 's' : ''}
        {progress.failed ? `, ${progress.failed} introuvable${progress.failed > 1 ? 's' : ''} (précise numéro, rue et ville dans le bon)` : ''}.
      </span>
    </div>
  );
}
