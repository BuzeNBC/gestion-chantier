import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase'; // Ajoutez cet import
import { 
  LayoutDashboard, 
  Hammer, 
  Building2, 
  LogOut,
  UserCog
} from 'lucide-react';
import { DBService } from '../services/dbService';
import TradesContent from './TradesContent';
import SiteManagement from './SiteManagement';
import WorkerInterface from './WorkerInterface';
import LoginModal from './LoginModal';

function DashboardContent() {
  const [sites, setSites] = useState([]);
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sitesData, tradesData] = await Promise.all([
          DBService.getAll('sites'),
          DBService.getAll('trades')
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
          <p className="text-3xl font-bold text-purple-600">{stats.totalTasks}</p>
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
  const [isRealAdmin, setIsRealAdmin] = useState(false); // Pour suivre le vrai rôle
  const [realUserRole, setRealUserRole] = useState(null); // Ajout de ce state
  const { signOut } = useAuth();
  const navigate = useNavigate();

  // Premier useEffect pour la vérification initiale du rôle
  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin') {
          setUserRole('admin');
          setRealUserRole('admin'); // Sauvegarde du rôle réel
        } else {
          setUserRole('worker');
          setRealUserRole('worker');
        }
      }
    };

    checkRole();
  }, []);

  // Log pour debug
  console.log('realUserRole:', realUserRole);
  console.log('userRole:', userRole);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  // Modification de handleRoleChange pour préserver l'état isRealAdmin
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

          {userRole === 'admin' && (
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
          )}

          <button
            onClick={handleRoleButtonClick}
            className="w-full flex items-center px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition duration-300"
          >
            <UserCog className="h-5 w-5 mr-2" />
            {userRole === 'admin' ? 'Mode ouvrier' : 'Mode admin'}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition duration-300"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Se déconnecter
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
          <WorkerInterface isAdminInWorkerMode={realUserRole === 'admin'} />
        )}
      </div>

      {showLoginModal && <LoginModal onClose={handleRoleChange} />}
    </div>
  );
}
export default AdminDashboard;