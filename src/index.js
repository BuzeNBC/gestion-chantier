import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

console.log('Application en cours de démarrage');

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  console.log('Root trouvé, tentative de rendu...');
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('Rendu terminé avec succès');
} catch (error) {
  console.error('Erreur lors du rendu:', error);
}

reportWebVitals();