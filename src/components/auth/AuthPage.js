import React, { useState } from 'react';
import { supabase } from '../../services/supabase';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Vérifier le rôle de l'utilisateur
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      // Vérifier si l'utilisateur a un rôle admin
      if (profile?.role === 'admin') {
        localStorage.setItem('userRole', 'admin');
      } else {
        localStorage.setItem('userRole', 'worker');
      }

      navigate('/');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        <h2 className="text-center text-3xl font-bold mb-8">
          {isLogin ? 'Connexion' : 'Inscription'}
        </h2>
  
        <div className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Email"
          />
  
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Mot de passe"
          />
  
          {error && (
            <div className="text-red-500 text-center">
              {error}
            </div>
          )}
  
          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-colors"
          >
            {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
          </button>
  
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-blue-500 hover:underline"
          >
            {isLogin ? "S'inscrire" : "Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;