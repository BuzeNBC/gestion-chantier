// Constantes et helpers du module Menuiserie.

// Types d'intervention
export const MENUISERIE_TYPES = {
  reparation_vr: 'Réparation volet roulant',
  prise_cote: 'Prise de cote',
  remplacement: 'Remplacement menuiserie',
  autre: 'Autre',
};

// Statuts d'un bon
export const MENUISERIE_STATUS = {
  todo: 'À faire',
  in_progress: 'En cours',
  completed: 'Terminé',
};

// Couleurs (classes Tailwind) associées à chaque statut, pour les badges
export const MENUISERIE_STATUS_STYLES = {
  todo: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

// Types d'ouvrant proposés lors de la prise de cote
export const OUVRANT_TYPES = [
  'Fenêtre',
  'Porte-fenêtre',
  'Porte',
  'Coulissant',
  'Volet roulant',
  'Volet battant',
  'Baie vitrée',
  'Autre',
];

export const MENUISERIE_PHOTO_CATEGORIES = {
  avant: 'Avant',
  apres: 'Après',
  autre: 'Autre',
};

// Libellé lisible d'un type d'intervention (avec repli)
export const typeLabel = (type) => MENUISERIE_TYPES[type] || MENUISERIE_TYPES.autre;

// Libellé lisible d'un statut (avec repli)
export const statusLabel = (status) => MENUISERIE_STATUS[status] || MENUISERIE_STATUS.todo;
