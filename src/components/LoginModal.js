import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { X } from 'lucide-react';

function LoginModal({ onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  // Récupérer l'email de l'utilisateur actuellement connecté
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserEmail(user.email);
      }
    };
    getCurrentUser();
  }, []);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Vérifier le mot de passe avec l'utilisateur actuellement connecté
      const { data, error } = await supabase.auth.signInWithPassword({
        email: currentUserEmail, // Utiliser l'email de l'utilisateur actuel
        password
      });

      if (error) throw error;

      // Vérifier le rôle
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role === 'admin') {
        onClose('admin');
      } else {
        setError('Accès non autorisé');
      }
      
    } catch (error) {
      console.error('Erreur de connexion:', error);
      setError('Mot de passe incorrect');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Connexion Administrateur</h2>
          <button 
            onClick={() => onClose('worker')}
            className="text-gray-400 hover:text-gray-600 transition duration-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              id="password"
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleLogin();
                }
              }}
            />
            {error && (
              <p className="text-red-500 text-sm mt-1">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => onClose('worker')}
              className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100"
              disabled={isLoading}
            >
              Annuler
            </button>
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;