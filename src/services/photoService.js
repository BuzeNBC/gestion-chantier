import { supabase } from './supabase';

// Détecte les photos HEIC/HEIF (format natif iPhone) que les navigateurs de
// bureau ne savent pas décoder : on les convertit en JPEG avant tout.
const isHeic = (file) => {
  const type = (file?.type || '').toLowerCase();
  if (type.includes('heic') || type.includes('heif')) return true;
  return /\.(heic|heif)$/i.test(file?.name || '');
};

export const PhotoService = {
  // Conversion HEIC -> JPEG dans le navigateur. La librairie (lourde) n'est
  // chargée qu'à la demande, uniquement quand une photo HEIC se présente.
  convertHeicToJpeg: async (file) => {
    try {
      const { default: heic2any } = await import('heic2any');
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      return Array.isArray(out) ? out[0] : out;
    } catch (e) {
      console.error('Erreur conversion HEIC :', e);
      throw new Error(
        "Cette photo HEIC (iPhone) n'a pas pu être convertie. " +
        'Réessaie, ou convertis-la en JPEG avant de la charger.'
      );
    }
  },

  // Compression de l'image (redimensionnement + réencodage JPEG).
  // Toute erreur de lecture/décodage rejette avec un message clair au lieu
  // de laisser le bouton bloqué sur « Compression… ».
  compressImage: async (file) => {
    return new Promise((resolve, reject) => {
      const fail = () => reject(new Error(
        "Impossible de lire cette image (format non pris en charge par le navigateur)."
      ));
      const reader = new FileReader();
      reader.onerror = fail;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = fail;
        img.onload = () => {
          const canvas = document.createElement('canvas');

          let { width, height } = img;
          // 1600px max : photo bien lisible (détails de chantier visibles)
          // pour un fichier qui reste léger.
          const MAX_WIDTH = 1600;
          const MAX_HEIGHT = 1600;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round(height * (MAX_WIDTH / width));
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round(width * (MAX_HEIGHT / height));
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else fail();
            },
            'image/jpeg',
            0.8
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // Upload de la photo vers Supabase avec mise en cache
  uploadPhoto: async (file, siteId, taskId) => {
    try {
      let fileToUpload = file;
      // Photos iPhone : conversion HEIC -> JPEG obligatoire (quelle que soit
      // la taille), sinon le navigateur ne peut ni les compresser ni les afficher.
      if (isHeic(fileToUpload)) {
        fileToUpload = await PhotoService.convertHeicToJpeg(fileToUpload);
      }
      // Compression si nécessaire (> 1MB)
      if (fileToUpload.size > 1024 * 1024) {
        fileToUpload = await PhotoService.compressImage(fileToUpload);
      }

      const fileName = `${siteId}/${taskId}/${Date.now()}.jpg`;
      const cacheKey = `photo_${fileName}`;

      const { error } = await supabase.storage
        .from('photos')
        .upload(`public/photos/${fileName}`, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (error) throw error;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(`public/photos/${fileName}`);

      // Mettre en cache
      sessionStorage.setItem(cacheKey, publicUrl);

      return {
        url: publicUrl,
        id: fileName
      };
    } catch (error) {
      console.error('Erreur upload:', error);
      throw error;
    }
  },

  // Récupérer l'URL d'une photo (avec cache)
  getPhotoUrl: (fileName) => {
    const cacheKey = `photo_${fileName}`;
    const cachedUrl = sessionStorage.getItem(cacheKey);
    
    if (cachedUrl) return cachedUrl;
    
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(`public/photos/${fileName}`);
      
    sessionStorage.setItem(cacheKey, publicUrl);
    return publicUrl;
  },

  // Supprimer une photo
  deletePhoto: async (fileName) => {
    try {
      const { error } = await supabase.storage
        .from('photos')
        .remove([`public/photos/${fileName}`]);

      if (error) throw error;

      // Nettoyer le cache
      sessionStorage.removeItem(`photo_${fileName}`);

      return true;
    } catch (error) {
      console.error('Erreur suppression:', error);
      throw error;
    }
  }
};