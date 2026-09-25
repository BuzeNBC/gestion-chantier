import React, { useState, useRef } from 'react';
import { Paperclip, Trash2, Download } from 'lucide-react';
import {
  uploadAttachment, deleteAttachment, formatFileSize, fileTypeIcon,
  MAX_ATTACHMENT_SIZE_MB,
} from '../../services/menuiserieAttachments';

// Éditeur de pièces jointes pour un bon.
// - readOnly=false (admin) : affiche un bouton "Ajouter" + permet de supprimer
//   chaque ligne. Les fichiers sont uploadés vers Supabase Storage *immédiatement*
//   et l'objet attachment ajouté à `attachments` via onChange.
// - readOnly=true (menuisier ou détail admin) : affiche juste la liste avec
//   bouton "Ouvrir" sur chaque ligne. Pas d'upload, pas de delete.
//
// `orderId` est utilisé comme préfixe de chemin Storage (peut être un futur id).
function AttachmentsEditor({ attachments = [], onChange, orderId, readOnly = false, uploadedBy = null }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const newOnes = [];
      for (const file of Array.from(files)) {
        try {
          const att = await uploadAttachment(file, orderId, uploadedBy);
          newOnes.push(att);
        } catch (e) {
          console.error('Upload échoué pour', file.name, e);
          setError(`Échec : ${file.name} — ${e.message || e}`);
        }
      }
      if (newOnes.length > 0) {
        onChange([...(attachments || []), ...newOnes]);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (att) => {
    if (!window.confirm(`Supprimer "${att.name}" ?`)) return;
    try {
      if (att.path) await deleteAttachment(att.path);
    } catch (e) {
      console.warn('Suppression Storage échouée (on retire quand même de la liste) :', e);
    }
    onChange((attachments || []).filter((a) => a.id !== att.id));
  };

  return (
    <div className="space-y-2">
      {(attachments || []).length === 0 && readOnly && (
        <p className="text-sm text-gray-400 italic">Aucune pièce jointe.</p>
      )}

      {(attachments || []).map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg bg-white"
        >
          <span className="text-lg flex-shrink-0">{fileTypeIcon(att.content_type)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{att.name}</p>
            <p className="text-xs text-gray-500">
              {formatFileSize(att.size)}
              {att.uploaded_at && (
                <> · {new Date(att.uploaded_at).toLocaleDateString('fr-FR')}</>
              )}
            </p>
          </div>
          <a
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
            download={att.name}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Ouvrir</span>
          </a>
          {!readOnly && (
            <button
              type="button"
              onClick={() => handleRemove(att)}
              className="text-red-500 hover:text-red-700 p-1"
              aria-label="Supprimer la pièce jointe"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <>
          <label className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer
            ${uploading ? 'bg-gray-200 text-gray-500 cursor-wait' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
            <Paperclip className="h-4 w-4" />
            {uploading ? 'Envoi en cours…' : 'Ajouter une pièce jointe'}
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.heic"
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-xs text-gray-400">
            Formats : PDF, images, Word, Excel, texte. Max {MAX_ATTACHMENT_SIZE_MB} Mo par fichier.
          </p>
        </>
      )}
    </div>
  );
}

export default AttachmentsEditor;
