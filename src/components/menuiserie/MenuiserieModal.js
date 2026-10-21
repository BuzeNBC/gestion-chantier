import React, { memo } from 'react';
import { X } from 'lucide-react';

// Fenêtre modale du module menuiserie (partagée admin / menuisier).
// `wide` élargit à 3xl (détail de bon, carte…). Le contenu défile si besoin.
// `size="xl"` : très large (carte + volet latéral).
const MenuiserieModal = memo(({ title, onClose, children, wide = false, size }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
    <div className={`bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full ${size === 'xl' ? 'max-w-6xl' : wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto`}>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fermer">
          <X className="h-6 w-6" />
        </button>
      </div>
      {children}
    </div>
  </div>
));

export default MenuiserieModal;
