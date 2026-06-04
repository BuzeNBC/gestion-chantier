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

// Libellé lisible d'un type d'intervention.
// Le type d'un bon provient des tâches du corps d'état « Menuiserie » : c'est
// donc déjà un libellé lisible, qu'on affiche tel quel. On garde la table
// MENUISERIE_TYPES en repli pour d'éventuelles anciennes valeurs (clés).
export const typeLabel = (type) => {
  if (!type) return MENUISERIE_TYPES.autre;
  return MENUISERIE_TYPES[type] || type;
};

// Détecte le corps d'état « Menuiserie » parmi une liste de corps d'état.
// L'app n'en a qu'un seul ; on le repère par son nom (insensible à la casse).
export const findMenuiserieTrade = (trades = []) =>
  trades.find((t) => (t.name || '').toLowerCase().includes('menuis')) || null;

// Libellé lisible d'un statut (avec repli)
export const statusLabel = (status) => MENUISERIE_STATUS[status] || MENUISERIE_STATUS.todo;

// Forme par défaut d'une intervention à l'intérieur d'un bon.
// Utilise un UUID client-side pour identifier l'intervention dans le tableau.
export const newIntervention = (type = '', createdBy = null) => ({
  id: typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : (
    'iv-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  ),
  type,
  status: 'todo',
  measurements: [],
  photos: [],
  notes: '',
  completed_date: null,
  created_at: new Date().toISOString(),
  created_by: createdBy,
});

// Statut agrégé d'un bon depuis ses interventions :
//   - aucune intervention -> 'todo'
//   - toutes terminées    -> 'completed'
//   - toutes à faire      -> 'todo'
//   - mélange             -> 'in_progress'
export const computeOrderStatus = (interventions = []) => {
  if (!interventions || interventions.length === 0) return 'todo';
  const statuses = interventions.map((i) => i.status || 'todo');
  if (statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.every((s) => s === 'todo')) return 'todo';
  return 'in_progress';
};

// Liste des interventions d'un bon, en gérant le repli vers le mode legacy
// (un bon créé AVANT ce refactor n'a pas d'`interventions` array mais a un
// champ `type` au niveau bon : on en fabrique une seule intervention virtuelle).
export const orderInterventions = (order) => {
  if (!order) return [];
  if (Array.isArray(order.interventions) && order.interventions.length > 0) {
    return order.interventions;
  }
  if (order.type) {
    return [{
      id: order.id + '-legacy',
      type: order.type,
      status: order.status || 'todo',
      measurements: order.measurements || [],
      photos: order.photos || [],
      notes: order.notes || '',
      completed_date: order.completed_date || null,
      created_at: order.created_at,
      created_by: null,
      _legacy: true,
    }];
  }
  return [];
};
