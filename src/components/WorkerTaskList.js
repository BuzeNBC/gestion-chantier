import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

const WorkerTaskList = ({ sites }) => {
    // Grouper par chantier puis par pièce
    return (
      <div className="space-y-8">
        {sites.map(site => (
          <div key={site.id} className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">{site.name}</h2>
            <p className="text-sm text-gray-500 mb-4">{site.address}</p>
            
            {/* Grouper les tâches par pièce */}
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
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{task.description}</p>
                          <p className="text-sm text-gray-500">
                            {site.trades?.find(t => t.id === task.tradeId)?.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleTaskStatus(site.id, task.id)}
                            className={`p-2 rounded-full ${
                              task.completed 
                                ? 'text-green-600 hover:bg-green-100' 
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            {task.completed ? (
                              <CheckCircle className="h-6 w-6" />
                            ) : (
                              <AlertCircle className="h-6 w-6" />
                            )}
                          </button>
                        </div>
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