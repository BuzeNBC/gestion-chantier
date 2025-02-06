import { supabase } from './supabase';

export const PhotoService = {
  // Compression de l'image
  compressImage: async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          let { width, height } = img;
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          
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
              resolve(blob);
            },
            'image/jpeg',
            0.7
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
      // Compression si nécessaire (> 1MB)
      let fileToUpload = file;
      if (file.size > 1024 * 1024) {
        fileToUpload = await PhotoService.compressImage(file);
      }

      const fileName = `${siteId}/${taskId}/${Date.now()}.jpg`;
      const cacheKey = `photo_${fileName}`;

      const { data, error } = await supabase.storage
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