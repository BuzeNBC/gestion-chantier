import React, { useState, useCallback } from 'react';
import { Camera, Image } from 'lucide-react';
import { PhotoService } from '../services/photoService';

// Bouton d'ajout de photos (prise directe + galerie).
// `multiple` (opt-in) : autorise la sélection de plusieurs photos d'un coup
// dans la galerie (PC comme iPhone). Les envois se font l'un après l'autre,
// avec un compteur de progression ; `onFileSelected(url, id)` est appelé pour
// chaque photo envoyée.
const PhotoUploadButton = ({ onFileSelected, siteId, taskId, className = "", multiple = false }) => {
  const [progress, setProgress] = useState(null); // { current, total } | null
  const isBusy = progress !== null;

  const handleUpload = useCallback(async (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (list.length === 0) return;

    const failures = [];
    setProgress({ current: 0, total: list.length });
    try {
      for (let i = 0; i < list.length; i++) {
        setProgress({ current: i + 1, total: list.length });
        try {
          const result = await PhotoService.uploadPhoto(list[i], siteId, taskId);
          onFileSelected(result.url, result.id);
        } catch (error) {
          console.error(`Erreur lors du traitement de ${list[i].name || 'la photo'} :`, error);
          failures.push({ name: list[i].name || `photo ${i + 1}`, message: error?.message });
        }
      }
    } finally {
      setProgress(null);
    }

    if (failures.length > 0) {
      const detail = failures[0].message || "Erreur lors du traitement de l'image";
      alert(
        failures.length === list.length && list.length === 1
          ? detail
          : `${failures.length} photo${failures.length > 1 ? 's' : ''} sur ${list.length} n'a/ont pas pu être envoyée(s) (${failures.map((f) => f.name).join(', ')}).\n${detail}`
      );
    }
  }, [siteId, taskId, onFileSelected]);

  const handleInputChange = useCallback((e) => {
    const files = e.target.files;
    // Réinitialise l'input pour pouvoir re-sélectionner les mêmes fichiers.
    const input = e.target;
    handleUpload(files).finally(() => { input.value = ''; });
  }, [handleUpload]);

  // Libellé pendant l'envoi : compteur seulement s'il y a plusieurs photos.
  const busyLabel = progress && progress.total > 1
    ? `Envoi ${progress.current}/${progress.total}…`
    : 'Compression...';

  return (
    <div className={`flex gap-2 ${className}`}>
      <label className={`flex items-center gap-2 ${
        isBusy
          ? 'bg-gray-400 cursor-wait'
          : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
        } text-white px-3 py-1 rounded-lg transition-colors`}>
        <Camera className="h-4 w-4" />
        <span>{isBusy ? busyLabel : 'Photo'}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleInputChange}
          disabled={isBusy}
        />
      </label>

      <label className={`flex items-center gap-2 ${
        isBusy
          ? 'bg-gray-400 cursor-wait'
          : 'bg-gray-600 hover:bg-gray-700 cursor-pointer'
        } text-white px-3 py-1 rounded-lg transition-colors`}>
        <Image className="h-4 w-4" />
        <span>{isBusy ? busyLabel : (multiple ? 'Galerie (multi)' : 'Galerie')}</span>
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={handleInputChange}
          disabled={isBusy}
        />
      </label>
    </div>
  );
};

export default PhotoUploadButton;
