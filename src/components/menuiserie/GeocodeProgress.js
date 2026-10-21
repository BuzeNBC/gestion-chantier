import React from 'react';
import { Loader2, MapPin, MapPinOff, AlertTriangle } from 'lucide-react';

// Bandeau discret de la localisation automatique (cf. useAutoGeocode).
export default function GeocodeProgress({ progress, className = '' }) {
  if (!progress) return null;
  if (!progress.finished) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
        Localisation des adresses… {progress.done}/{progress.total}
      </div>
    );
  }
  const problems = (progress.failed || 0) + (progress.errors || 0);
  if (progress.ok === 0 && problems === 0) return null;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
      progress.errors ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'
    } ${className}`}>
      {progress.errors ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> : progress.failed ? <MapPinOff className="h-4 w-4 flex-shrink-0" /> : <MapPin className="h-4 w-4 flex-shrink-0" />}
      <span>
        {progress.ok} adresse{progress.ok > 1 ? 's' : ''} localisée{progress.ok > 1 ? 's' : ''}
        {progress.failed ? `, ${progress.failed} introuvable${progress.failed > 1 ? 's' : ''} (précise numéro, rue et ville)` : ''}
        {progress.errors ? `, ${progress.errors} en erreur (migration 0016 appliquée ? connexion ?)` : ''}.
      </span>
    </div>
  );
}
