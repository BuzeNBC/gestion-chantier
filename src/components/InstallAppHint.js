import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

// Aide à l'installation de l'app sur l'écran d'accueil (PWA légère, sans
// service worker). Android/Chrome : bouton « Installer » (beforeinstallprompt).
// iOS/Safari : instructions « Partager -> Sur l'écran d'accueil ».
// Masquée une fois l'app installée (display-mode: standalone) ou fermée.
const DISMISS_KEY = 'installHint.dismissed';

const isStandalone = () =>
  (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)
  || (typeof navigator !== 'undefined' && navigator.standalone === true);

const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function InstallAppHint() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [promptEvent, setPromptEvent] = useState(null);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed || isStandalone()) return null;
  const ios = isIOS();
  if (!ios && !promptEvent) return null; // navigateur sans installation possible

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* stockage indisponible */ }
  };

  const install = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') dismiss();
    setPromptEvent(null);
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
      <Download className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">Installe l'app sur ton téléphone</p>
        {ios ? (
          <p className="text-blue-800">
            Dans Safari : bouton <Share className="inline h-4 w-4 align-text-bottom" /> Partager, puis
            « <strong>Sur l'écran d'accueil</strong> ». Elle s'ouvrira en plein écran comme une vraie app.
          </p>
        ) : (
          <button onClick={install} className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">
            Installer l'application
          </button>
        )}
      </div>
      <button onClick={dismiss} className="p-1 text-blue-700 hover:bg-blue-100 rounded" aria-label="Fermer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
