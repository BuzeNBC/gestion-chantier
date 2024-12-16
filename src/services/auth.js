// services/auth.js
import { supabase } from './supabase';

export const AUTH_ROLES = {
  ADMIN: 'admin',
  WORKER: 'worker'
};

// Dans auth.js
export const signIn = async (password) => {
    try {
      console.log('Tentative de connexion avec:', {
        email: process.env.REACT_APP_ADMIN_EMAIL,
        // Ne pas logger le mot de passe en production !
      });
  
      const { data, error } = await supabase.auth.signInWithPassword({
        email: process.env.REACT_APP_ADMIN_EMAIL,
        password: password
      });
  
      if (error) {
        console.log('Erreur de connexion:', error);
        throw error;
      }
  
      console.log('Connexion réussie:', data);
  
      // Vérifier si l'utilisateur a le rôle admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
  
      if (profileError) {
        console.log('Erreur profil:', profileError);
        throw profileError;
      }
  
      console.log('Profil trouvé:', profile);
  
      if (profile?.role !== 'admin') {
        throw new Error('Accès non autorisé');
      }
  
      return data;
    } catch (error) {
      console.error('Erreur détaillée:', error);
      throw error;
    }
  };