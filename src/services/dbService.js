import { supabase } from './supabase';

if (!supabase) {
  throw new Error('Supabase client is not initialized');
}

// Fonction utilitaire pour générer des UUID
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Définition des stores disponibles dans l'application
export const STORES = {
  PHOTOS: "photos",
  SITES: "sites", 
  TRADES: "trades"
};

export class DBService {
  // Méthode pour stocker des données
  static async store(storeName, data) {
    try {
      console.log('Tentative de stockage dans:', storeName);
      console.log('Données à stocker:', data);

      if (!supabase) {
        throw new Error('Le client Supabase n\'est pas initialisé');
      }

      const { data: result, error } = await supabase
        .from(storeName)
        .upsert([data])
        .select();
      
      if (error) {
        console.error('Erreur Supabase:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Données stockées avec succès:', result);
      return result?.[0] || data;
    } catch (error) {
      console.error(`Erreur détaillée lors du stockage dans ${storeName}:`, {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
  }

  // Méthode pour récupérer un document spécifique
  static async get(storeName, id) {
    try {
      if (!supabase) {
        throw new Error('Le client Supabase n\'est pas initialisé');
      }

      const { data, error } = await supabase
        .from(storeName)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Erreur lors de la récupération de ${storeName}/${id}:`, error);
      throw error;
    }
  }

  // Méthode pour récupérer tous les documents d'une collection
  static async getAll(storeName) {
    try {
      if (!supabase) {
        throw new Error('Le client Supabase n\'est pas initialisé');
      }

      const { data, error } = await supabase
        .from(storeName)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      console.log(`Données récupérées avec succès de ${storeName}:`, data);
      return data || [];
    } catch (error) {
      console.error(`Erreur lors de la récupération des données de ${storeName}:`, error);
      throw error;
    }
  }

  // Méthode pour supprimer un document
  static async delete(storeName, id) {
    try {
      if (!supabase) {
        throw new Error('Le client Supabase n\'est pas initialisé');
      }

      const { error } = await supabase
        .from(storeName)
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      console.log(`Document supprimé avec succès de ${storeName}/${id}`);
    } catch (error) {
      console.error(`Erreur lors de la suppression de ${storeName}/${id}:`, error);
      throw error;
    }
  }
}

// Fonction utilitaire pour compresser les images
export const compressImage = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        
        try {
          if (!supabase) {
            throw new Error('Le client Supabase n\'est pas initialisé');
          }

          const fileName = `${generateUUID()}.jpg`;
          
          const { data, error } = await supabase.storage
            .from('photos')
            .upload(fileName, dataUrl.split(',')[1], {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (error) {
            console.error('Erreur upload Supabase:', error);
            throw error;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('photos')
            .getPublicUrl(fileName);

          resolve(publicUrl);
        } catch (error) {
          console.error('Erreur lors de l\'upload de l\'image:', error);
          throw error;
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};