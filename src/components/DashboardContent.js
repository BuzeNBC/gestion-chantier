import React, { useState } from 'react';
import { DBService, STORES } from '../services/dbService';
import { LineChart, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, Bar } from 'recharts';

const DashboardContent = () => {
  const [sites] = useState(() => {
    try {
      const storedSites = DBService.getAll(STORES.SITES);
      return storedSites || [];
    } catch {
      return [];
    }
  });

  const [trades] = useState(() => {
    try {
      const storedTrades = DBService.getAll(STORES.TRADES);
      return storedTrades || [];
    } catch {
      return [];
    }
  });

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

  // Préparation des données pour les graphiques
const siteProgressData = sites.map(site => {
  const totalTasks = site.tasks?.length || 0;
  const completedTasks = site.tasks?.filter(task => task.completed)?.length || 0;
  return {
    name: site.name.length > 15 ? site.name.substring(0, 15) + '...' : site.name,
    progression: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  };
}).slice(0, 5); // Limiter aux 5 derniers sites

const dailyProgressData = [...Array(7)].map((_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - i);
  const dayTasks = sites.flatMap(site => 
    site.tasks?.filter(task => 
      task.completedAt && 
      new Date(task.completedAt).toDateString() === date.toDateString()
    ) || []
  );
  return {
    name: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
    completed: dayTasks.length
  };
}).reverse();

  // Dans le composant DashboardContent, juste avant le return final, ajoutez :
const progressData = sites.map(site => {
  const completedTasks = site.tasks?.filter(task => task.completed)?.length || 0;
  const totalTasks = site.tasks?.length || 0;
  return {
    name: site.name,
    progression: totalTasks ? (completedTasks / totalTasks) * 100 : 0
  };
});

// Dans le JSX, après le premier grid de statistiques, ajoutez :
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h3 className="text-xl font-semibold text-gray-800 mb-4">
      Progression par chantier
    </h3>
    <BarChart width={500} height={300} data={progressData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="progression" fill="#3B82F6" name="Progression (%)" />
    </BarChart>
  </div>
  
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h3 className="text-xl font-semibold text-gray-800 mb-4">
      Activité récente
    </h3>
    <div className="space-y-4 max-h-[300px] overflow-y-auto">
      {sites.flatMap(site => 
        site.tasks
          ?.filter(task => task.completedAt)
          ?.map(task => ({
            siteName: site.name,
            taskName: task.description,
            date: task.completedAt
          }))
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)
      .map((activity, index) => (
        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium">{activity.taskName}</p>
            <p className="text-sm text-gray-500">{activity.siteName}</p>
          </div>
          <span className="text-sm text-gray-500">
            {new Date(activity.date).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  </div>
</div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-xl font-semibold text-gray-800 mb-4">
      Progression par chantier
    </h2>
    <div className="h-[300px]">
      <BarChart width={500} height={300} data={siteProgressData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="progression" fill="#3B82F6" name="Progression (%)" />
      </BarChart>
    </div>
  </div>

  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-xl font-semibold text-gray-800 mb-4">
      Activité journalière
    </h2>
    <div className="h-[300px]">
      <LineChart width={500} height={300} data={dailyProgressData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="completed" stroke="#3B82F6" name="Tâches terminées" />
      </LineChart>
    </div>
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
};

export default DashboardContent;