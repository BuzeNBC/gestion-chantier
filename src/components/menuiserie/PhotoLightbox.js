import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { MENUISERIE_PHOTO_CATEGORIES } from '../../services/menuiserieService';

// Visionneuse plein écran : clic sur une photo pour l'agrandir, flèches /
// boutons pour passer à la suivante, Échap ou clic en dehors pour fermer.
//   photos   [{ id, url, category }]
//   index    photo affichée
//   onIndex  (i) => void
//   onClose  () => void
export default function PhotoLightbox({ photos = [], index = 0, onIndex, onClose }) {
  const count = photos.length;
  const photo = photos[index];

  const prev = useCallback(() => onIndex?.((index - 1 + count) % count), [index, count, onIndex]);
  const next = useCallback(() => onIndex?.((index + 1) % count), [index, count, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft' && count > 1) prev();
      else if (e.key === 'ArrowRight' && count > 1) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next, count]);

  if (!photo) return null;
  const caption = MENUISERIE_PHOTO_CATEGORIES[photo.category] || photo.category || '';

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center select-none"
      onClick={onClose}
      role="dialog"
      aria-label="Photo agrandie"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
        className="absolute top-3 right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/25"
        aria-label="Fermer"
      >
        <X className="h-6 w-6" />
      </button>

      {count > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 text-white hover:bg-white/25"
            aria-label="Photo précédente"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 text-white hover:bg-white/25"
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        </>
      )}

      <figure className="max-w-[96vw] max-h-[92vh] flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={caption || 'Photo'}
          className="max-w-[96vw] max-h-[84vh] object-contain rounded-lg shadow-2xl"
          draggable={false}
        />
        <figcaption className="text-white/90 text-sm flex items-center gap-3">
          {caption && <span className="px-2 py-0.5 rounded-full bg-white/15">{caption}</span>}
          {count > 1 && <span>{index + 1} / {count}</span>}
          <a href={photo.url} target="_blank" rel="noopener noreferrer" className="underline text-white/70 hover:text-white">
            Ouvrir l'original
          </a>
        </figcaption>
      </figure>
    </div>
  );
}
