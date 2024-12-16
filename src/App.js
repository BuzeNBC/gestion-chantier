import React, { useState, useEffect } from 'react';
import { signIn } from './services/auth';  // Ajoutez cet import
import { 
  LayoutDashboard, 
  Hammer, 
  Building2, 
  Plus, 
  X, 
  Edit, 
  Trash, 
  ListPlus, 
  Search,
  Camera,
  FileText,
  Mail,
  CheckCircle,
  AlertCircle,
  UserCog
} from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DBService, compressImage } from './services/dbService';
import TradesContent from './components/TradesContent';
import SiteManagement from './components/SiteManagement';
import WorkerInterface from './components/WorkerInterface'

// Constantes
const STORES = {
  PHOTOS: "photos",
  SITES: "sites",
  TRADES: "trades"
};

// Composants réutilisables
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition duration-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SearchBar({ searchTerm, onSearchChange }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
      <input
        type="text"
        placeholder="Rechercher..."
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}

function LoginModal({ onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 3;

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Vérifier le nombre de tentatives
      if (attempts >= maxAttempts) {
        setError('Trop de tentatives. Veuillez réessayer plus tard.');
        return;
      }

      await signIn(password);
      onClose('admin');
      
    } catch (error) {
      setAttempts(prev => prev + 1);
      setError('Mot de passe incorrect');
      
      // Si nombre maximum de tentatives atteint
      if (attempts + 1 >= maxAttempts) {
        setError('Trop de tentatives. Veuillez réessayer plus tard.');
        // Optionnel : Bloquer temporairement les tentatives
        setTimeout(() => {
          setAttempts(0);
        }, 15 * 60 * 1000); // 15 minutes de blocage
      }
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
              disabled={isLoading || attempts >= maxAttempts}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleLogin();
                }
              }}
            />
            {error && (
              <p className="text-red-500 text-sm mt-1">{error}</p>
            )}
            {attempts > 0 && attempts < maxAttempts && (
              <p className="text-yellow-600 text-sm mt-1">
                Tentatives restantes : {maxAttempts - attempts}
              </p>
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
              disabled={isLoading || attempts >= maxAttempts}
              className={`px-4 py-2 rounded-lg ${
                isLoading || attempts >= maxAttempts
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

function DashboardContent() {
  const [sites, setSites] = useState([]);
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sitesData, tradesData] = await Promise.all([
          DBService.getAll(STORES.SITES),
          DBService.getAll(STORES.TRADES)
        ]);
        setSites(sitesData || []);
        setTrades(tradesData || []);
      } catch (error) {
        console.error('Erreur chargement données:', error);
      }
    };
  
    loadData();
  }, []);

  const stats = {
    totalSites: sites.length,
    completedSites: sites.filter(site => 
      site.tasks?.length > 0 && site.tasks.every(task => task.completed)
    ).length,
    totalTasks: sites.reduce((acc, site) => acc + (site.tasks?.length || 0), 0),
    completedTasks: sites.reduce((acc, site) => 
      acc + (site.tasks?.filter(task => task.completed)?.length || 0), 0
    ),
    totalTrades: trades.length,
    progressPercentage: sites.length ? (sites.reduce((acc, site) => {
      const siteTasks = site.tasks?.length || 0;
      const completedTasks = site.tasks?.filter(task => task.completed)?.length || 0;
      return siteTasks > 0 ? acc + (completedTasks / siteTasks) : acc;
    }, 0) / sites.length * 100) : 0
  };

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-gray-800">Tableau de bord</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Corps d'état
          </h2>
          <p className="text-3xl font-bold text-blue-600">{stats.totalTrades}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Chantiers
          </h2>
          <p className="text-3xl font-bold text-green-600">{stats.totalSites}</p>
          <p className="text-sm text-gray-500">
            {stats.completedSites} terminés
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Tâches
          </h2>
          <p className="text-3xl font-bold text-purple-600">
            {stats.totalTasks}
          </p>
          <p className="text-sm text-gray-500">
            {stats.completedTasks} terminées
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Progression globale
          </h2>
          <p className="text-3xl font-bold text-orange-600">
            {stats.progressPercentage.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Chantiers récents
        </h2>
        <div className="space-y-4">
          {sites.slice(0, 5).map(site => (
            <div key={site.id} className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="font-semibold">{site.name}</h3>
                <p className="text-sm text-gray-500">{site.address}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  {site.tasks?.filter(task => task.completed).length || 0}/{site.tasks?.length || 0} tâches
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  site.status === 'completed' ? 'bg-green-100 text-green-800' :
                  site.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {site.status === 'completed' ? 'Terminé' :
                   site.status === 'in-progress' ? 'En cours' : 'Planifié'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [userRole, setUserRole] = useState('worker');
  const [showLoginModal, setShowLoginModal] = useState(false);

   // Ajoutez ce useEffect pour le débogage
   useEffect(() => {
    console.log('Application démarrée');
    // Vérifiez si vos services sont chargés
    console.log('Services disponibles:', {
      auth: !!signIn,
      db: !!DBService
    });
  }, []);

  const handleRoleChange = (role) => {
    setUserRole(role);
    setShowLoginModal(false);
    setActivePage('dashboard');
  };

  const handleRoleButtonClick = () => {
    if (userRole === 'worker') {
      setShowLoginModal(true);
    } else {
      handleRoleChange('worker');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-lg">
        <div className="px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-800">
            {userRole === 'admin' ? 'Administration' : 'Interface Ouvrier'}
          </h1>
        </div>
        <nav className="px-6 py-4 space-y-2">
          <button
            onClick={() => setActivePage('dashboard')}
            className={`w-full flex items-center px-4 py-2 rounded-lg ${
              activePage === 'dashboard' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            } transition duration-300`}
          >
            <LayoutDashboard className="h-5 w-5 mr-2" />
            Tableau de bord
          </button>

          {userRole === 'admin' ? (
            <>
              <button
                onClick={() => setActivePage('trades')}
                className={`w-full flex items-center px-4 py-2 rounded-lg ${
                  activePage === 'trades' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                } transition duration-300`}
              >
                <Hammer className="h-5 w-5 mr-2" />
                Corps d'état
              </button>
              <button
                onClick={() => setActivePage('sites')}
                className={`w-full flex items-center px-4 py-2 rounded-lg ${
                  activePage === 'sites' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                } transition duration-300`}
              >
                <Building2 className="h-5 w-5 mr-2" />
                Chantiers
              </button>
            </>
          ) : null}

          <button
            onClick={handleRoleButtonClick}
            className="w-full flex items-center px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition duration-300"
          >
            <UserCog className="h-5 w-5 mr-2" />
            {userRole === 'admin' ? 'Mode ouvrier' : 'Mode admin'}
          </button>
        </nav>
      </div>

      <div className="flex-1 p-8">
        {userRole === 'admin' ? (
          <>
            {activePage === 'dashboard' && <DashboardContent />}
            {activePage === 'trades' && <TradesContent />}
            {activePage === 'sites' && <SiteManagement />}
          </>
        ) : (
          <WorkerInterface />
        )}
      </div>

      {showLoginModal && <LoginModal onClose={handleRoleChange} />}
    </div>
  );
}

export default AdminDashboard;