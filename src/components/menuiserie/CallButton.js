import React from 'react';
import { PhoneCall } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { telHref } from '../../services/menuiserieService';
import { logCall, lastCall, orderCalls, callLabel } from '../../services/callLog';

// Lien « Appeler » (tel:) qui journalise l'appel : qui, quand. Le composeur
// s'ouvre normalement ; l'enregistrement se fait en parallèle et n'empêche
// jamais l'appel (en cas d'erreur, simple avertissement en console).
//   byName    nom affiché dans la pastille (sinon : début de l'e-mail)
//   onLogged  reçoit le nouveau journal pour mettre à jour l'état local
export default function CallButton({ order, byName, onLogged, className = '', title, children }) {
  const { user } = useAuth();
  const href = telHref(order?.client_phone);
  if (!href) return null;

  const handleClick = () => {
    const name = byName || (user?.email ? user.email.split('@')[0] : null);
    logCall(order, { userId: user?.id || null, byName: name })
      .then((next) => onLogged?.(next))
      .catch((e) => console.warn('Appel non journalisé :', e));
  };

  return (
    <a href={href} onClick={handleClick} className={className} title={title || `Appeler ${order.client_phone}`}>
      {children}
    </a>
  );
}

// Pastille « Appelé le 21/10 à 14:32 (Franck) » (+ nombre d'appels).
// L'infobulle liste tous les appels.
export const CallBadge = ({ order, className = '' }) => {
  const calls = orderCalls(order);
  const last = lastCall(order);
  if (!last) return null;
  const history = [...calls]
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .map(callLabel)
    .join('\n');
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-800 border border-green-200 whitespace-nowrap ${className}`}
      title={history}
    >
      <PhoneCall className="h-3 w-3" />
      {callLabel(last)}{calls.length > 1 ? ` · ${calls.length} appels` : ''}
    </span>
  );
};
