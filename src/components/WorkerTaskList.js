import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

const WorkerTaskList = ({ sites, onToggleTask }) => {
  // Fonction pour formater l'affichage de la mesure
  const formatMeasure = (task) => {
    if (!task.measureType) return '';
    
    switch (task.measureType) {
      case 'square_meters':
        return `${task.quantity || 0} m²`;
      case 'units':
        return `${task.quantity || 0} unité${task.quantity > 1 ? 's' : ''}`;
      case 'fixed_price':
        return 'Forfait';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-8">
      {sites.map(site => (
        <div key={site.id} className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">{site.name}</h2>
          <p className="text-sm text-gray-500 mb-4">{site.address}</p>
          
          {Object.entries(
            site.tasks.reduce((acc, task) => {
              const room = task.room || 'Non assigné';
              if (!acc[room]) acc[room] = [];
              acc[room].push(task);
              return acc;
            }, {})
          ).map(([room, tasks]) => (
            <div key={room} className="mb-6">
              <h3 className="font-medium text-lg text-gray-700 mb-3">{room}</h3>
              <div className="space-y-2">
                {tasks.map(task => (
                  <div 
                    key={task.id} 
                    className={`p-4 rounded-lg border ${
                      task.completed 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-white border-gray-200 hover:border-blue-200 transition-colors'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{task.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-gray-600">
                                {site.trades?.find(t => t.id === task.tradeId)?.name}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-sm font-medium text-blue-600">
                                {formatMeasure(task)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleTask(site.id, task.id)}
                        className={`p-2 rounded-full transition-colors ${
                          task.completed 
                            ? 'text-green-600 hover:bg-green-100' 
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={task.completed ? "Marquer comme non terminé" : "Marquer comme terminé"}
                      >
                        {task.completed ? (
                          <CheckCircle className="h-6 w-6" />
                        ) : (
                          <AlertCircle className="h-6 w-6" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default WorkerTaskList;