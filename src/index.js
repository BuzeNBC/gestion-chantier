import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <div style={{padding: '20px', fontSize: '24px'}}>
      Test d'affichage basique
      <App />
    </div>
  </React.StrictMode>
);