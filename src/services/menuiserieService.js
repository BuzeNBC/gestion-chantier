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

// Sous-sections du module Menuiserie (onglets côté admin)
export const MENUISERIE_CATEGORIES = {
  petites_interventions: 'Petites interventions',
  commande_portes: 'Commande de portes',
};

export const orderCategory = (order) =>
  MENUISERIE_CATEGORIES[order?.category] ? order.category : 'petites_interventions';

export const categoryLabel = (category) =>
  MENUISERIE_CATEGORIES[category] || MENUISERIE_CATEGORIES.petites_interventions;

// Statuts de facturation d'un bon — parcours de la secrétaire :
// devis à faire -> devis fait -> à facturer -> facturé
export const BILLING_STATUS = {
  devis_a_faire: 'Devis à faire',
  devis_fait: 'Devis fait',
  a_facturer: 'À facturer',
  facture: 'Facturé',
};

export const BILLING_STATUS_STYLES = {
  devis_a_faire: 'bg-sky-100 text-sky-800',
  devis_fait: 'bg-purple-100 text-purple-800',
  a_facturer: 'bg-amber-100 text-amber-800',
  facture: 'bg-emerald-100 text-emerald-800',
};

export const billingLabel = (status) => {
  // Anciennes valeurs (avant migration 0008) : on les mappe pour l'affichage.
  if (status === 'devis_envoye') return BILLING_STATUS.devis_fait;
  return BILLING_STATUS[status] || BILLING_STATUS.devis_a_faire;
};

// Un bon n'est facturable que lorsque TOUTES ses interventions sont terminées.
export const isOrderBillable = (order) =>
  computeOrderStatus(orderInterventions(order)) === 'completed';

// Statut de facturation « effectif » pour l'affichage :
//   - bon non terminé et rien renseigné par la secrétaire -> null (le parcours
//     devis/facture ne démarre que quand le bon est terminé)
//   - sinon le statut stocké (les statuts saisis volontairement restent
//     affichés même si le bon repasse en cours)
export const effectiveBillingStatus = (order) => {
  let s = order?.billing_status || 'devis_a_faire';
  if (s === 'devis_envoye') s = 'devis_fait'; // ancienne valeur (avant 0008)
  // Un bon non terminé ne peut être ni « devis à faire » ni « à facturer »
  // (« à facturer » couvre aussi l'ancien défaut d'une base non migrée).
  if ((s === 'devis_a_faire' || s === 'a_facturer') && !isOrderBillable(order)) return null;
  return s;
};

// Style du badge « relances » selon leur nombre : 1 = jaune, 2 = orange, 3+ = rouge.
export const relanceBadgeStyle = (count) => {
  if (count >= 3) return 'bg-red-100 text-red-800';
  if (count === 2) return 'bg-orange-100 text-orange-800';
  if (count === 1) return 'bg-yellow-100 text-yellow-800';
  return '';
};

// Bordure gauche de la ligne dans la liste admin, même code couleur.
export const relanceBorderStyle = (count) => {
  if (count >= 3) return 'border-l-4 border-red-500';
  if (count === 2) return 'border-l-4 border-orange-400';
  if (count === 1) return 'border-l-4 border-yellow-400';
  return '';
};

export const orderRelances = (order) => (Array.isArray(order?.relances) ? order.relances : []);

export const newRelance = () => ({
  id: typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : (
    'rl-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  ),
  date: new Date().toISOString().slice(0, 10),
  note: '',
  created_at: new Date().toISOString(),
});

// Total HT d'un bon = somme des prix des interventions qui en ont un.
export const orderTotalHt = (order) =>
  orderInterventions(order).reduce((sum, iv) => {
    const p = Number(iv.price_ht);
    return sum + (Number.isFinite(p) ? p : 0);
  }, 0);

export const fmtEuro = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
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
