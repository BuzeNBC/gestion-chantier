import { supabase } from './supabase';

// Bucket dédié aux pièces jointes des bons de menuiserie (PDF, photos brutes, docs…).
// Public en lecture (URLs servies directement aux navigateurs), écriture
// restreinte aux admins via les policies storage.objects.
const BUCKET = 'menuiserie_attachments';

// Limite côté client pour éviter d'envoyer des fichiers énormes depuis mobile.
export const MAX_ATTACHMENT_SIZE_MB = 15;

// Formate une taille en octets en chaîne lisible (Ko, Mo).
export const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
};

// Petite icône emoji selon le type MIME pour l'affichage dans la liste.
export const fileTypeIcon = (contentType = '') => {
  const t = contentType.toLowerCase();
  if (t.startsWith('image/')) return '🖼️';
  if (t === 'application/pdf') return '📄';
  if (t.includes('word') || t.includes('officedocument.wordprocessingml')) return '📝';
  if (t.includes('sheet') || t.includes('excel')) return '📊';
  if (t.startsWith('video/')) return '🎬';
  if (t.startsWith('audio/')) return '🎵';
  if (t === 'text/plain') return '📃';
  return '📎';
};

// Génère un id unique (compatible navigateurs anciens si crypto absent).
const uuid = () =>
  typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'at-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

// Nettoie un nom de fichier pour le chemin Storage (caractères ASCII safe).
const safeFileName = (name) =>
  (name || 'fichier')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');

// Upload une pièce jointe pour un bon donné. `orderId` peut être l'id futur
// d'un bon en cours de création — on l'utilise juste comme préfixe de chemin.
//
// Retourne l'objet attachment à pousser dans le tableau `attachments` du bon :
//   { id, name, url, size, content_type, path, uploaded_at, uploaded_by }
export const uploadAttachment = async (file, orderId, uploadedBy = null) => {
  if (!file) throw new Error('Aucun fichier');
  const sizeMb = file.size / 1024 / 1024;
  if (sizeMb > MAX_ATTACHMENT_SIZE_MB) {
    throw new Error(`Fichier trop volumineux (${sizeMb.toFixed(1)} Mo). Max : ${MAX_ATTACHMENT_SIZE_MB} Mo.`);
  }

  const attachmentId = uuid();
  const path = `${orderId}/${attachmentId}-${safeFileName(file.name)}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    id: attachmentId,
    name: file.name,
    url: publicUrl,
    size: file.size,
    content_type: file.type || 'application/octet-stream',
    path,
    uploaded_at: new Date().toISOString(),
    uploaded_by: uploadedBy,
  };
};

// Supprime un fichier du bucket à partir de son chemin Storage.
export const deleteAttachment = async (path) => {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
};
